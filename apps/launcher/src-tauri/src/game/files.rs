//! Client jar, libraries, natives and assets for a version.

use std::collections::HashMap;
use std::io::Read;
use std::path::{Path, PathBuf};

use reqwest::Client;
use serde::Deserialize;

use super::version::{maven_path, rules_allow, FileRef, VersionJson};
use crate::downloads::{self, Download};
use crate::error::Result;
use crate::platform::{mojang_os, Paths};

pub struct Libraries {
    pub downloads: Vec<Download>,
    pub classpath: Vec<PathBuf>,
    /// Pre-1.19 native jars that must be unpacked into the natives folder.
    pub native_jars: Vec<PathBuf>,
}

/// The vanilla client jar. Its download always lives under the vanilla id; loader profiles
/// get their own copy named after the profile, because Forge's module loader looks for
/// `${version_name}.jar` to keep the vanilla jar off the module path.
pub fn client_jar(paths: &Paths, v: &VersionJson) -> (Download, PathBuf) {
    let base = v.base_id.as_deref().unwrap_or(&v.id);
    let download = Download {
        url: v.downloads.client.url.clone(),
        path: paths.versions().join(base).join(format!("{base}.jar")),
        sha1: Some(v.downloads.client.sha1.clone()),
        size: Some(v.downloads.client.size),
    };
    let launch_path = paths.versions().join(&v.id).join(format!("{}.jar", v.id));
    (download, launch_path)
}

/// Hard-links (or copies) the vanilla jar to the profile's own name.
pub fn link_client_jar(from: &Path, to: &Path) -> Result<()> {
    if from == to {
        return Ok(());
    }
    let same = matches!((std::fs::metadata(from), std::fs::metadata(to)), (Ok(a), Ok(b)) if a.len() == b.len());
    if same {
        return Ok(());
    }
    if let Some(p) = to.parent() {
        std::fs::create_dir_all(p)?;
    }
    let _ = std::fs::remove_file(to);
    if std::fs::hard_link(from, to).is_err() {
        std::fs::copy(from, to)?;
    }
    Ok(())
}

fn file_download(f: &FileRef, path: PathBuf) -> Option<Download> {
    // Empty URLs mark files a loader installer generates locally.
    (!f.url.is_empty()).then(|| Download {
        url: f.url.clone(),
        path,
        sha1: (!f.sha1.is_empty()).then(|| f.sha1.clone()),
        size: (f.size > 0).then_some(f.size),
    })
}

pub fn libraries(paths: &Paths, v: &VersionJson) -> Libraries {
    let mut out = Libraries {
        downloads: Vec::new(),
        classpath: Vec::new(),
        native_jars: Vec::new(),
    };
    let arch_bits = if std::env::consts::ARCH == "x86" {
        "32"
    } else {
        "64"
    };

    for lib in v
        .libraries
        .iter()
        .filter(|l| rules_allow(&l.rules) && l.clientreq != Some(false))
    {
        let Some(dl) = &lib.downloads else {
            // Maven-style loader library: name + repository URL. With `natives`, only the
            // OS-specific classifier jar exists (e.g. Legacy Fabric's LWJGL 2).
            let repo = lib
                .url
                .as_deref()
                .unwrap_or("https://libraries.minecraft.net/")
                .trim_end_matches('/');
            let native = lib
                .natives
                .as_ref()
                .map(|n| n.get(mojang_os()).map(|c| c.replace("${arch}", arch_bits)));
            let coord = match &native {
                Some(Some(c)) => format!("{}:{c}", lib.name),
                Some(None) => continue,
                None => lib.name.clone(),
            };
            if let Some(rel) = maven_path(&coord) {
                let path = paths.libraries().join(&rel);
                out.downloads.push(Download {
                    url: format!("{repo}/{rel}"),
                    path: path.clone(),
                    // The hash in the profile is for the main jar, not a natives classifier.
                    sha1: if native.is_some() {
                        None
                    } else {
                        lib.sha1.clone()
                    },
                    size: if native.is_some() { None } else { lib.size },
                });
                if native.is_some() {
                    out.native_jars.push(path);
                } else {
                    out.classpath.push(path);
                }
            }
            continue;
        };

        if let Some(a) = &dl.artifact {
            let rel = a.path.clone().or_else(|| maven_path(&lib.name));
            if let Some(rel) = rel {
                let path = paths.libraries().join(rel);
                out.downloads.extend(file_download(a, path.clone()));
                out.classpath.push(path);
            }
        }

        let classifier = lib
            .natives
            .as_ref()
            .and_then(|n| n.get(mojang_os()))
            .map(|c| c.replace("${arch}", arch_bits));
        if let (Some(c), Some(classifiers)) = (classifier, &dl.classifiers) {
            if let Some(f) = classifiers.get(&c) {
                if let Some(rel) = &f.path {
                    let path = paths.libraries().join(rel);
                    out.downloads.extend(file_download(f, path.clone()));
                    out.native_jars.push(path);
                }
            }
        }
    }
    out
}

/// Unpacks old-style native jars (skipping META-INF) into a clean `dest`.
pub fn extract_natives(jars: &[PathBuf], dest: &Path) -> Result<()> {
    if dest.exists() {
        std::fs::remove_dir_all(dest)?;
    }
    std::fs::create_dir_all(dest)?;
    for jar in jars {
        let mut zip = zip::ZipArchive::new(std::fs::File::open(jar)?)?;
        for i in 0..zip.len() {
            let mut entry = zip.by_index(i)?;
            let Some(name) = entry.enclosed_name() else {
                continue;
            };
            if entry.is_dir() || name.starts_with("META-INF") {
                continue;
            }
            let out = dest.join(name);
            if let Some(p) = out.parent() {
                std::fs::create_dir_all(p)?;
            }
            let mut buf = Vec::new();
            entry.read_to_end(&mut buf)?;
            std::fs::write(out, buf)?;
        }
    }
    Ok(())
}

#[derive(Deserialize)]
struct AssetIndex {
    objects: HashMap<String, AssetObject>,
    #[serde(default, rename = "virtual")]
    is_virtual: bool,
    #[serde(default)]
    map_to_resources: bool,
}

#[derive(Deserialize)]
struct AssetObject {
    hash: String,
    size: u64,
}

/// Downloads every asset object. Returns the directory to pass as `${game_assets}`,
/// which differs from the shared store only for very old (pre-1.7) versions.
pub async fn assets<F>(
    client: &Client,
    paths: &Paths,
    v: &VersionJson,
    game_dir: &Path,
    on_progress: F,
) -> Result<PathBuf>
where
    F: Fn(usize, usize) + Send + Sync,
{
    let root = paths.assets();
    let index: AssetIndex = downloads::cached_json(
        client,
        &v.asset_index.url,
        &root
            .join("indexes")
            .join(format!("{}.json", v.asset_index.id)),
        Some(&v.asset_index.sha1),
    )
    .await?;

    let object = |hash: &str| root.join("objects").join(&hash[..2]).join(hash);
    let items = index
        .objects
        .values()
        .map(|o| Download {
            url: format!(
                "https://resources.download.minecraft.net/{}/{}",
                &o.hash[..2],
                o.hash
            ),
            path: object(&o.hash),
            sha1: Some(o.hash.clone()),
            size: Some(o.size),
        })
        .collect();
    downloads::fetch_all(client, items, on_progress).await?;

    let legacy_dir = if index.map_to_resources {
        Some(game_dir.join("resources"))
    } else if index.is_virtual {
        Some(root.join("virtual").join(&v.asset_index.id))
    } else {
        None
    };
    if let Some(dir) = &legacy_dir {
        for (name, o) in &index.objects {
            let dest = dir.join(name);
            if !dest.exists() {
                if let Some(p) = dest.parent() {
                    tokio::fs::create_dir_all(p).await?;
                }
                tokio::fs::copy(object(&o.hash), &dest).await?;
            }
        }
    }
    Ok(legacy_dir.unwrap_or(root))
}
