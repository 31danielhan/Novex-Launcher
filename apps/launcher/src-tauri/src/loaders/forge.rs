//! Forge and NeoForge, installed by replaying their installer jars.
//!
//! Modern installers (Forge 1.13+, all NeoForge) ship a version JSON plus "processors":
//! small Java programs that patch and remap the game. Old Forge (1.12.2 and earlier)
//! ships the profile under `versionInfo` and a universal jar to drop into libraries.

use std::collections::HashMap;
use std::io::Read;
use std::path::{Path, PathBuf};

use reqwest::Client;
use serde::Deserialize;
use sha1::{Digest, Sha1};

use super::{version_key, LoaderKind, LoaderVersion};
use crate::downloads::{self, Download};
use crate::error::{msg, Result};
use crate::game::version::{maven_path, Library, ProfileJson, VersionJson};
use crate::platform::{classpath_separator, Paths};

const FORGE_MAVEN: &str = "https://maven.minecraftforge.net/net/minecraftforge/forge";
const NEOFORGE_MAVEN: &str = "https://maven.neoforged.net/releases/net/neoforged/neoforge";

fn installer_url(kind: LoaderKind, v: &str) -> String {
    match kind {
        LoaderKind::Forge => format!("{FORGE_MAVEN}/{v}/forge-{v}-installer.jar"),
        _ => format!("{NEOFORGE_MAVEN}/{v}/neoforge-{v}-installer.jar"),
    }
}

pub async fn forge_versions(http: &Client, game: &str) -> Result<Vec<LoaderVersion>> {
    let xml = downloads::get_text(http, &format!("{FORGE_MAVEN}/maven-metadata.xml")).await?;
    #[derive(Deserialize)]
    struct Promos {
        promos: HashMap<String, String>,
    }
    let promos = downloads::get_json::<Promos>(
        http,
        "https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json",
    )
    .await
    .map(|p| p.promos)
    .unwrap_or_default();
    let recommended = promos.get(&format!("{game}-recommended"));

    let prefix = format!("{game}-");
    let suffix = format!("-{game}");
    let mut list: Vec<LoaderVersion> = xml
        .split("<version>")
        .skip(1)
        .filter_map(|s| s.split("</version>").next())
        .filter(|full| full.starts_with(&prefix))
        .map(|full| {
            let label = full[prefix.len()..].trim_end_matches(&suffix).to_string();
            LoaderVersion {
                id: full.to_string(),
                recommended: recommended == Some(&label),
                stable: true,
                label,
            }
        })
        .collect();
    list.sort_by_key(|v| std::cmp::Reverse(version_key(&v.label)));
    Ok(list)
}

/// NeoForge numbers follow the game: 21.1.x → 1.21.1, 21.0.x → 1.21, 26.3.0.x → 26.3.
fn neoforge_game(v: &str) -> Option<String> {
    let base = v.split('-').next()?;
    let p: Vec<&str> = base.split('.').collect();
    let (a, b) = (p.first()?.parse::<u32>().ok()?, *p.get(1)?);
    Some(if a >= 26 {
        match p.get(2) {
            Some(&"0") | None => format!("{a}.{b}"),
            Some(c) => format!("{a}.{b}.{c}"),
        }
    } else if b == "0" {
        format!("1.{a}")
    } else {
        format!("1.{a}.{b}")
    })
}

pub async fn neoforge_versions(http: &Client, game: &str) -> Result<Vec<LoaderVersion>> {
    #[derive(Deserialize)]
    struct Versions {
        versions: Vec<String>,
    }
    let all: Versions = downloads::get_json(
        http,
        "https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge",
    )
    .await?;
    let mut list: Vec<LoaderVersion> = all
        .versions
        .into_iter()
        .filter(|v| neoforge_game(v).as_deref() == Some(game))
        .map(|v| LoaderVersion {
            stable: !v.contains("beta") && !v.contains("alpha"),
            recommended: false,
            label: v.clone(),
            id: v,
        })
        .collect();
    list.sort_by_key(|v| std::cmp::Reverse(version_key(&v.id)));
    Ok(list)
}

fn read_entry(jar: &Path, name: &str) -> Result<Option<Vec<u8>>> {
    let file = std::fs::File::open(jar)
        .map_err(|e| msg(format!("Couldn't open {}: {e}", jar.display())))?;
    let mut zip = zip::ZipArchive::new(file)?;
    let result = match zip.by_name(name) {
        Ok(mut f) => {
            let mut buf = Vec::new();
            f.read_to_end(&mut buf)?;
            Some(buf)
        }
        Err(zip::result::ZipError::FileNotFound) => None,
        Err(e) => return Err(e.into()),
    };
    Ok(result)
}

fn extract_entry(jar: &Path, name: &str, dest: &Path) -> Result<bool> {
    let Some(bytes) = read_entry(jar, name)? else {
        return Ok(false);
    };
    if let Some(p) = dest.parent() {
        std::fs::create_dir_all(p)?;
    }
    std::fs::write(dest, bytes)?;
    Ok(true)
}

fn main_class(jar: &Path) -> Result<String> {
    let manifest = read_entry(jar, "META-INF/MANIFEST.MF")?
        .ok_or_else(|| msg(format!("{} has no manifest", jar.display())))?;
    String::from_utf8_lossy(&manifest)
        .lines()
        .find_map(|l| l.strip_prefix("Main-Class:").map(|m| m.trim().to_string()))
        .ok_or_else(|| msg(format!("{} has no Main-Class", jar.display())))
}

fn sha1_file(path: &Path) -> Option<String> {
    std::fs::read(path)
        .ok()
        .map(|b| hex::encode(Sha1::digest(b)))
}

#[derive(Deserialize)]
struct InstallProfile {
    json: String,
    #[serde(default)]
    data: HashMap<String, SideValue>,
    #[serde(default)]
    processors: Vec<Processor>,
    #[serde(default)]
    libraries: Vec<Library>,
}

#[derive(Deserialize)]
struct SideValue {
    client: String,
}

#[derive(Deserialize)]
struct Processor {
    jar: String,
    #[serde(default)]
    classpath: Vec<String>,
    #[serde(default)]
    args: Vec<String>,
    #[serde(default)]
    outputs: HashMap<String, String>,
    sides: Option<Vec<String>>,
}

pub async fn install<P>(
    http: &Client,
    paths: &Paths,
    kind: LoaderKind,
    version: &str,
    vanilla: &VersionJson,
    java: &Path,
    progress: &P,
) -> Result<ProfileJson>
where
    P: Fn(&str, usize, usize) + Send + Sync,
{
    let name = kind.label().to_lowercase();
    let dir = paths.meta().join("installers");
    let installer = dir.join(format!("{name}-{version}-installer.jar"));
    let done = dir.join(format!("{name}-{version}.json"));
    if let Ok(bytes) = tokio::fs::read(&done).await {
        if let Ok(p) = serde_json::from_slice(&bytes) {
            return Ok(p);
        }
    }

    let url = installer_url(kind, version);
    let sha1 = match http.get(format!("{url}.sha1")).send().await {
        Ok(r) if r.status().is_success() => r
            .text()
            .await
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| s.len() == 40),
        _ => None,
    };
    downloads::fetch_all(
        http,
        vec![Download {
            url,
            path: installer.clone(),
            sha1,
            size: None,
        }],
        |d, t| progress(&format!("Downloading {} installer", kind.label()), d, t),
    )
    .await?;

    let raw: serde_json::Value = serde_json::from_slice(
        &read_entry(&installer, "install_profile.json")?
            .ok_or_else(|| msg("This doesn't look like a Forge installer."))?,
    )?;

    let profile_bytes = if raw.get("versionInfo").is_some() {
        install_legacy(paths, &installer, &raw)?
    } else {
        let ip: InstallProfile = serde_json::from_value(raw)?;
        install_modern(
            http, paths, kind, version, &installer, ip, vanilla, java, progress,
        )
        .await?
    };

    let profile: ProfileJson = serde_json::from_slice(&profile_bytes)?;
    tokio::fs::write(&done, &profile_bytes).await?;
    Ok(profile)
}

/// Forge 1.12.2 and older: copy the universal jar into libraries and use `versionInfo`.
fn install_legacy(paths: &Paths, installer: &Path, raw: &serde_json::Value) -> Result<Vec<u8>> {
    let install = &raw["install"];
    let coord = install["path"]
        .as_str()
        .ok_or_else(|| msg("Installer has no install.path"))?;
    let file = install["filePath"]
        .as_str()
        .ok_or_else(|| msg("Installer has no install.filePath"))?;
    let dest = paths
        .libraries()
        .join(maven_path(coord).ok_or_else(|| msg("Bad Forge coordinate"))?);
    if !extract_entry(installer, file, &dest)? {
        return Err(msg("Forge universal jar is missing from the installer."));
    }
    Ok(serde_json::to_vec(&raw["versionInfo"])?)
}

#[allow(clippy::too_many_arguments)]
async fn install_modern<P>(
    http: &Client,
    paths: &Paths,
    kind: LoaderKind,
    version: &str,
    installer: &Path,
    ip: InstallProfile,
    vanilla: &VersionJson,
    java: &Path,
    progress: &P,
) -> Result<Vec<u8>>
where
    P: Fn(&str, usize, usize) + Send + Sync,
{
    let label = kind.label();
    let version_bytes = read_entry(installer, ip.json.trim_start_matches('/'))?
        .ok_or_else(|| msg("Installer is missing its version JSON."))?;
    let vjson: ProfileJson = serde_json::from_slice(&version_bytes)?;

    // Libraries for both the processors and the game. Files with no URL are bundled
    // in the installer under maven/ (or produced by the processors below).
    let lib_path = |coord: &str| -> PathBuf {
        paths
            .libraries()
            .join(maven_path(coord).unwrap_or_else(|| coord.to_string()))
    };
    let mut dls = Vec::new();
    for lib in ip.libraries.iter().chain(vjson.libraries.iter()) {
        let Some(a) = lib.downloads.as_ref().and_then(|d| d.artifact.as_ref()) else {
            continue;
        };
        let Some(rel) = a.path.clone().or_else(|| maven_path(&lib.name)) else {
            continue;
        };
        let path = paths.libraries().join(&rel);
        if a.url.is_empty() {
            if !path.exists() {
                extract_entry(installer, &format!("maven/{rel}"), &path)?;
            }
        } else {
            dls.push(Download {
                url: a.url.clone(),
                path,
                sha1: (!a.sha1.is_empty()).then(|| a.sha1.clone()),
                size: (a.size > 0).then_some(a.size),
            });
        }
    }
    downloads::fetch_all(http, dls, |d, t| {
        progress(&format!("Downloading {label} libraries"), d, t)
    })
    .await?;

    let work = paths
        .meta()
        .join("installers")
        .join(format!("{}-{version}", label.to_lowercase()));
    let base = vanilla.base_id.as_deref().unwrap_or(&vanilla.id);
    let s = |p: &Path| p.to_string_lossy().into_owned();
    let mut data: HashMap<String, String> = HashMap::from([
        ("SIDE".into(), "client".into()),
        (
            "MINECRAFT_JAR".into(),
            s(&paths.versions().join(base).join(format!("{base}.jar"))),
        ),
        ("MINECRAFT_VERSION".into(), base.to_string()),
        ("ROOT".into(), s(&paths.root)),
        ("INSTALLER".into(), s(installer)),
        ("LIBRARY_DIR".into(), s(&paths.libraries())),
    ]);
    for (key, v) in &ip.data {
        let val = &v.client;
        let resolved = if let Some(coord) = val.strip_prefix('[').and_then(|x| x.strip_suffix(']'))
        {
            s(&lib_path(coord))
        } else if let Some(lit) = val.strip_prefix('\'').and_then(|x| x.strip_suffix('\'')) {
            lit.to_string()
        } else if let Some(entry) = val.strip_prefix('/') {
            let dest = work.join(entry);
            extract_entry(installer, entry, &dest)?;
            s(&dest)
        } else {
            val.clone()
        };
        data.insert(key.clone(), resolved);
    }

    let subst = |arg: &str| -> String {
        if let Some(key) = arg.strip_prefix('{').and_then(|x| x.strip_suffix('}')) {
            if let Some(v) = data.get(key) {
                return v.clone();
            }
        }
        if let Some(coord) = arg.strip_prefix('[').and_then(|x| x.strip_suffix(']')) {
            return s(&lib_path(coord));
        }
        let mut out = arg.to_string();
        for (k, v) in &data {
            out = out.replace(&format!("{{{k}}}"), v);
        }
        out
    };

    let processors: Vec<&Processor> = ip
        .processors
        .iter()
        .filter(|p| {
            p.sides
                .as_ref()
                .map_or(true, |s| s.iter().any(|x| x == "client"))
        })
        .collect();
    let total = processors.len();
    for (i, p) in processors.iter().enumerate() {
        progress(&format!("Installing {label}"), i, total);

        // Skip steps whose outputs already exist with the expected hashes.
        let outputs_ok = !p.outputs.is_empty()
            && p.outputs.iter().all(|(file, hash)| {
                let expected = subst(hash);
                let expected = expected.trim_matches('\'');
                sha1_file(Path::new(&subst(file))).is_some_and(|h| h.eq_ignore_ascii_case(expected))
            });
        if outputs_ok {
            continue;
        }

        let jar = lib_path(&p.jar);
        let main = main_class(&jar)?;
        let classpath: Vec<String> = std::iter::once(s(&jar))
            .chain(p.classpath.iter().map(|c| s(&lib_path(c))))
            .collect();
        let args: Vec<String> = p.args.iter().map(|a| subst(a)).collect();

        let mut cmd = tokio::process::Command::new(java);
        cmd.arg("-cp")
            .arg(classpath.join(classpath_separator()))
            .arg(&main)
            .args(&args)
            .current_dir(&paths.root);
        #[cfg(windows)]
        cmd.creation_flags(0x0800_0000);
        let out = cmd
            .output()
            .await
            .map_err(|e| msg(format!("Couldn't run {label} installer step: {e}")))?;
        if !out.status.success() {
            let log = String::from_utf8_lossy(&[out.stdout, out.stderr].concat()).into_owned();
            let tail: Vec<&str> = log.lines().rev().take(12).collect();
            eprintln!("[{label}] processor {main} failed:\n{log}");
            return Err(msg(format!(
                "{label} install step {} of {total} failed ({main}):\n{}",
                i + 1,
                tail.into_iter().rev().collect::<Vec<_>>().join("\n")
            )));
        }
    }
    progress(&format!("Installing {label}"), total, total);
    Ok(version_bytes)
}

#[cfg(test)]
mod tests {
    use super::neoforge_game;

    #[test]
    fn maps_neoforge_versions_to_game_versions() {
        assert_eq!(neoforge_game("21.1.77").as_deref(), Some("1.21.1"));
        assert_eq!(neoforge_game("21.0.167").as_deref(), Some("1.21"));
        assert_eq!(neoforge_game("20.2.3-beta").as_deref(), Some("1.20.2"));
        assert_eq!(neoforge_game("26.3.0.100").as_deref(), Some("26.3"));
        assert_eq!(neoforge_game("26.1.2.5").as_deref(), Some("26.1.2"));
    }
}
