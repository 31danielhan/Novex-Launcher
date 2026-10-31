//! Modpacks become new instances. Supports Modrinth `.mrpack` files and CurseForge modpack
//! zips (`manifest.json`), whether downloaded from a source or imported from disk.

use std::collections::HashMap;
use std::io::Read;
use std::path::{Component, Path, PathBuf};

use reqwest::Client;
use serde::{Deserialize, Serialize};

use super::{curseforge, modrinth, ContentKind, Manifest, Source, Tracked};
use crate::downloads::{self, Download};
use crate::error::{msg, Result};
use crate::instances::{self, Instance, ModpackRef};
use crate::loaders::{self, LoaderKind};
use crate::platform::Paths;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Installed {
    pub instance: Instance,
    /// Files that couldn't be downloaded automatically (CurseForge authors can opt out of
    /// third-party downloads). The user has to add these by hand.
    pub skipped: Vec<String>,
}

/// Where a pack came from, when it was installed from a source rather than a file.
pub struct Origin {
    pub source: Source,
    pub project_id: String,
    pub version_id: String,
    pub version: String,
    pub title: String,
    pub icon_url: Option<String>,
}

pub async fn install_from_source<P>(
    http: &Client,
    paths: &Paths,
    source: Source,
    project_id: &str,
    version_id: Option<&str>,
    progress: P,
) -> Result<Installed>
where
    P: Fn(&str, usize, usize) + Send + Sync,
{
    progress("Finding the modpack", 0, 0);
    let list = super::versions(http, source, project_id, ContentKind::Modpack, None).await?;
    let v = match version_id {
        Some(w) => list.iter().find(|v| v.id == w),
        None => super::pick(&list),
    }
    .ok_or_else(|| msg("This modpack has no downloadable versions."))?;
    let info = super::project(http, source, project_id).await?;
    let url = v.file.url.clone().ok_or_else(|| {
        msg(format!(
            "The author of {} only allows downloads from the CurseForge website.",
            info.title
        ))
    })?;

    progress("Downloading the modpack", 0, 0);
    let file = paths
        .root
        .join("cache")
        .join("modpacks")
        .join(super::safe_file_name(&v.file.filename)?);
    let _ = tokio::fs::remove_file(&file).await;
    downloads::fetch_all(
        http,
        vec![Download {
            url,
            path: file.clone(),
            sha1: v.file.sha1.clone(),
            size: v.file.size,
        }],
        |_, _| {},
    )
    .await?;

    let origin = Origin {
        source,
        project_id: project_id.to_string(),
        version_id: v.id.clone(),
        version: v.version_number.clone(),
        title: info.title,
        icon_url: info.icon_url,
    };
    let result = install_file(http, paths, &file, Some(origin), progress).await;
    let _ = tokio::fs::remove_file(&file).await;
    result
}

// ---- Pack formats ------------------------------------------------------------------------

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MrIndex {
    name: String,
    version_id: String,
    files: Vec<MrFile>,
    dependencies: HashMap<String, String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MrFile {
    path: String,
    hashes: HashMap<String, String>,
    env: Option<MrEnv>,
    downloads: Vec<String>,
    file_size: Option<u64>,
}

#[derive(Deserialize)]
struct MrEnv {
    client: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CfManifest {
    minecraft: CfMinecraft,
    name: String,
    version: Option<String>,
    files: Vec<CfFile>,
    overrides: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CfMinecraft {
    version: String,
    mod_loaders: Vec<CfLoader>,
}

#[derive(Deserialize)]
struct CfLoader {
    id: String,
    #[serde(default)]
    primary: bool,
}

#[derive(Deserialize)]
struct CfFile {
    #[serde(rename = "projectID")]
    project_id: u64,
    #[serde(rename = "fileID")]
    file_id: u64,
    #[serde(default = "yes")]
    required: bool,
}

fn yes() -> bool {
    true
}

enum Pack {
    Modrinth(MrIndex),
    CurseForge(CfManifest),
}

fn read_entry(zip: &mut zip::ZipArchive<std::fs::File>, name: &str) -> Option<Vec<u8>> {
    let mut entry = zip.by_name(name).ok()?;
    let mut buf = Vec::new();
    entry.read_to_end(&mut buf).ok()?;
    Some(buf)
}

fn read_pack(file: &Path) -> Result<Pack> {
    let mut zip = zip::ZipArchive::new(std::fs::File::open(file)?)
        .map_err(|_| msg("That file isn't a modpack (.mrpack or CurseForge .zip)."))?;
    if let Some(b) = read_entry(&mut zip, "modrinth.index.json") {
        return Ok(Pack::Modrinth(serde_json::from_slice(&b)?));
    }
    if let Some(b) = read_entry(&mut zip, "manifest.json") {
        return Ok(Pack::CurseForge(serde_json::from_slice(&b)?));
    }
    Err(msg(
        "That file isn't a modpack (.mrpack or CurseForge .zip).",
    ))
}

/// A pack path like "mods/sodium.jar", refusing anything that could leave the game folder.
fn safe_rel(base: &Path, rel: &str) -> Result<PathBuf> {
    let p = Path::new(rel);
    if rel.is_empty() || !p.components().all(|c| matches!(c, Component::Normal(_))) {
        return Err(msg(format!("The modpack contains an unsafe path: {rel}")));
    }
    Ok(base.join(p))
}

/// Copies `prefix/...` entries of the pack into the game folder.
fn extract_overrides(file: &Path, game_dir: &Path, prefixes: &[String]) -> Result<()> {
    let mut zip = zip::ZipArchive::new(std::fs::File::open(file)?)?;
    for prefix in prefixes {
        for i in 0..zip.len() {
            let mut entry = zip.by_index(i)?;
            let Some(name) = entry.enclosed_name() else {
                continue;
            };
            let Ok(rel) = name.strip_prefix(prefix) else {
                continue;
            };
            if rel.as_os_str().is_empty() {
                continue;
            }
            let dest = game_dir.join(rel);
            if entry.is_dir() {
                std::fs::create_dir_all(&dest)?;
            } else {
                if let Some(parent) = dest.parent() {
                    std::fs::create_dir_all(parent)?;
                }
                std::io::copy(&mut entry, &mut std::fs::File::create(&dest)?)?;
            }
        }
    }
    Ok(())
}

async fn blocking<T: Send + 'static>(f: impl FnOnce() -> Result<T> + Send + 'static) -> Result<T> {
    tokio::task::spawn_blocking(f)
        .await
        .map_err(|e| msg(e.to_string()))?
}

/// The content kind of a top-level pack file, from its folder.
fn kind_of_path(rel: &str) -> Option<(ContentKind, String)> {
    let (folder, file) = rel.split_once('/')?;
    if file.contains('/') {
        return None;
    }
    let kind = match folder {
        "mods" => ContentKind::Mod,
        "resourcepacks" => ContentKind::ResourcePack,
        "shaderpacks" => ContentKind::Shader,
        _ => return None,
    };
    Some((kind, file.to_string()))
}

// ---- Installing --------------------------------------------------------------------------

/// Installs a pack file as a new instance. Removes the instance again if anything fails.
pub async fn install_file<P>(
    http: &Client,
    paths: &Paths,
    file: &Path,
    origin: Option<Origin>,
    progress: P,
) -> Result<Installed>
where
    P: Fn(&str, usize, usize) + Send + Sync,
{
    progress("Reading the modpack", 0, 0);
    let pack = {
        let f = file.to_path_buf();
        blocking(move || read_pack(&f)).await?
    };

    let (name, pack_version, game, loader) = match &pack {
        Pack::Modrinth(i) => {
            let game =
                i.dependencies.get("minecraft").cloned().ok_or_else(|| {
                    msg("The modpack doesn't say which Minecraft version it needs.")
                })?;
            let loader = [
                ("neoforge", LoaderKind::NeoForge),
                ("forge", LoaderKind::Forge),
                ("fabric-loader", LoaderKind::Fabric),
                ("quilt-loader", LoaderKind::Quilt),
            ]
            .into_iter()
            .find_map(|(k, kind)| i.dependencies.get(k).map(|v| (kind, v.clone())));
            (i.name.clone(), i.version_id.clone(), game, loader)
        }
        Pack::CurseForge(m) => {
            let l = m
                .minecraft
                .mod_loaders
                .iter()
                .find(|l| l.primary)
                .or(m.minecraft.mod_loaders.first());
            let loader = match l.and_then(|l| l.id.split_once('-')) {
                Some((k, v)) => Some((
                    match k {
                        "forge" => LoaderKind::Forge,
                        "neoforge" => LoaderKind::NeoForge,
                        "fabric" => LoaderKind::Fabric,
                        "quilt" => LoaderKind::Quilt,
                        other => return Err(msg(format!("Unsupported mod loader: {other}"))),
                    },
                    v.to_string(),
                )),
                None => None,
            };
            (
                m.name.clone(),
                m.version.clone().unwrap_or_default(),
                m.minecraft.version.clone(),
                loader,
            )
        }
    };

    let (kind, loader_version) = match loader {
        Some((kind, v)) => {
            progress("Checking the mod loader", 0, 0);
            (
                kind,
                Some(loaders::find_version(http, kind, &game, &v).await?),
            )
        }
        None => (LoaderKind::Vanilla, None),
    };
    let modpack = match &origin {
        Some(o) => ModpackRef {
            source: Some(o.source),
            project_id: Some(o.project_id.clone()),
            version_id: Some(o.version_id.clone()),
            version: o.version.clone(),
            icon_url: o.icon_url.clone(),
        },
        None => ModpackRef {
            source: None,
            project_id: None,
            version_id: None,
            version: pack_version,
            icon_url: None,
        },
    };
    let title = origin.as_ref().map_or(name, |o| o.title.clone());
    let inst = instances::create(paths, &title, game, kind, loader_version, Some(modpack))?;

    let result = match pack {
        Pack::Modrinth(index) => {
            populate_modrinth(http, paths, &inst, file, index, &progress).await
        }
        Pack::CurseForge(m) => populate_curseforge(http, paths, &inst, file, m, &progress).await,
    };
    match result {
        Ok(skipped) => Ok(Installed {
            instance: inst,
            skipped,
        }),
        Err(e) => {
            let _ = std::fs::remove_dir_all(instances::dir(paths, &inst.id));
            Err(e)
        }
    }
}

async fn populate_modrinth<P>(
    http: &Client,
    paths: &Paths,
    inst: &Instance,
    file: &Path,
    index: MrIndex,
    progress: &P,
) -> Result<Vec<String>>
where
    P: Fn(&str, usize, usize) + Send + Sync,
{
    let game_dir = instances::game_dir(paths, &inst.id);
    let mut items = Vec::new();
    let mut by_hash = HashMap::new();
    for f in &index.files {
        if f.env.as_ref().is_some_and(|e| e.client == "unsupported") {
            continue;
        }
        let Some(url) = f.downloads.first() else {
            continue;
        };
        let sha1 = f.hashes.get("sha1").cloned();
        if let (Some(h), Some(k)) = (&sha1, kind_of_path(&f.path)) {
            by_hash.insert(h.clone(), k);
        }
        items.push(Download {
            url: url.clone(),
            path: safe_rel(&game_dir, &f.path)?,
            sha1,
            size: f.file_size,
        });
    }
    downloads::fetch_all(http, items, |d, t| progress("Downloading mods", d, t)).await?;

    progress("Applying overrides", 0, 0);
    let (f, g) = (file.to_path_buf(), game_dir.clone());
    blocking(move || extract_overrides(&f, &g, &["overrides".into(), "client-overrides".into()]))
        .await?;

    // Names and icons for the content list. Best effort: the pack works without them.
    if let Ok(m) = track_modrinth(http, by_hash).await {
        m.save(paths, &inst.id)?;
    }
    Ok(vec![])
}

async fn track_modrinth(
    http: &Client,
    by_hash: HashMap<String, (ContentKind, String)>,
) -> Result<Manifest> {
    let hashes: Vec<String> = by_hash.keys().cloned().collect();
    let mut found = Vec::new();
    for chunk in hashes.chunks(500) {
        found.extend(modrinth::identify(http, chunk).await?);
    }
    let ids: Vec<String> = found.iter().map(|f| f.1.clone()).collect();
    let mut infos = HashMap::new();
    for chunk in ids.chunks(100) {
        infos.extend(modrinth::projects(http, chunk).await?);
    }
    let mut m = Manifest::default();
    for (hash, project_id, version_id, version) in found {
        let (Some((kind, file)), Some(info)) = (by_hash.get(&hash), infos.get(&project_id)) else {
            continue;
        };
        m.upsert(Tracked {
            kind: *kind,
            file: file.clone(),
            source: Source::Modrinth,
            project_id,
            version_id,
            title: info.title.clone(),
            version,
            icon_url: info.icon_url.clone(),
        });
    }
    Ok(m)
}

async fn populate_curseforge<P>(
    http: &Client,
    paths: &Paths,
    inst: &Instance,
    file: &Path,
    manifest: CfManifest,
    progress: &P,
) -> Result<Vec<String>>
where
    P: Fn(&str, usize, usize) + Send + Sync,
{
    let game_dir = instances::game_dir(paths, &inst.id);
    let wanted: Vec<&CfFile> = manifest.files.iter().filter(|f| f.required).collect();
    progress("Looking up mods", 0, 0);
    let files =
        curseforge::files(http, &wanted.iter().map(|f| f.file_id).collect::<Vec<_>>()).await?;
    let mods: HashMap<u64, curseforge::Mod> = curseforge::mods(
        http,
        &wanted.iter().map(|f| f.project_id).collect::<Vec<_>>(),
    )
    .await?
    .into_iter()
    .map(|m| (m.id, m))
    .collect();

    let mut items = Vec::new();
    let mut tracked = Manifest::default();
    let mut skipped = Vec::new();
    for f in files {
        let m = mods.get(&f.mod_id);
        let info = m.map(|m| m.info());
        let title = info
            .as_ref()
            .map_or(f.file_name.clone(), |i| i.title.clone());
        let kind = match info.as_ref().map(|i| i.kind) {
            Some(Some(
                k @ (ContentKind::Mod | ContentKind::ResourcePack | ContentKind::Shader),
            )) => k,
            Some(Some(_)) => {
                skipped.push(format!("{title} (unsupported content type)"));
                continue;
            }
            // Unknown class: almost always a mod.
            _ => ContentKind::Mod,
        };
        let Some(url) = f.download_url.clone() else {
            skipped.push(title);
            continue;
        };
        let name = super::safe_file_name(&f.file_name)?.to_string();
        items.push(Download {
            url,
            path: game_dir.join(kind.folder()).join(&name),
            sha1: f.sha1(),
            size: f.size(),
        });
        tracked.upsert(Tracked {
            kind,
            file: name.clone(),
            source: Source::CurseForge,
            project_id: f.mod_id.to_string(),
            version_id: f.id.to_string(),
            title,
            version: name,
            icon_url: info.and_then(|i| i.icon_url),
        });
    }
    downloads::fetch_all(http, items, |d, t| progress("Downloading mods", d, t)).await?;

    progress("Applying overrides", 0, 0);
    let prefix = manifest.overrides.unwrap_or_else(|| "overrides".into());
    let (f, g) = (file.to_path_buf(), game_dir);
    blocking(move || extract_overrides(&f, &g, &[prefix])).await?;
    tracked.save(paths, &inst.id)?;
    Ok(skipped)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pack_paths_stay_inside_the_game_dir() {
        let base = Path::new("/game");
        assert_eq!(
            safe_rel(base, "mods/a.jar").unwrap(),
            base.join("mods/a.jar")
        );
        for bad in ["../evil.jar", "/etc/passwd", "mods/../../x", ""] {
            assert!(safe_rel(base, bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn top_level_content_is_tracked_by_folder() {
        assert_eq!(
            kind_of_path("mods/a.jar"),
            Some((ContentKind::Mod, "a.jar".into()))
        );
        assert_eq!(
            kind_of_path("shaderpacks/b.zip"),
            Some((ContentKind::Shader, "b.zip".into()))
        );
        assert_eq!(kind_of_path("config/a.json"), None);
        assert_eq!(kind_of_path("mods/sub/a.jar"), None);
    }
}
