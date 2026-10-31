//! Client jar, libraries, natives and assets for a version.

use std::collections::HashMap;
use std::io::Read;
use std::path::{Path, PathBuf};

use reqwest::Client;
use serde::Deserialize;

use super::version::{rules_allow, VersionJson};
use crate::downloads::{self, Download};
use crate::error::Result;
use crate::platform::{mojang_os, Paths};

pub struct Libraries {
    pub downloads: Vec<Download>,
    pub classpath: Vec<PathBuf>,
    /// Pre-1.19 native jars that must be unpacked into the natives folder.
    pub native_jars: Vec<PathBuf>,
}

pub fn client_jar(paths: &Paths, v: &VersionJson) -> Download {
    Download {
        url: v.downloads.client.url.clone(),
        path: paths.versions().join(&v.id).join(format!("{}.jar", v.id)),
        sha1: Some(v.downloads.client.sha1.clone()),
        size: Some(v.downloads.client.size),
    }
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

    for lib in v.libraries.iter().filter(|l| rules_allow(&l.rules)) {
        let Some(dl) = &lib.downloads else { continue };

        if let Some(a) = &dl.artifact {
            if let Some(rel) = &a.path {
                let path = paths.libraries().join(rel);
                out.downloads.push(Download {
                    url: a.url.clone(),
                    path: path.clone(),
                    sha1: Some(a.sha1.clone()),
                    size: Some(a.size),
                });
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
                    out.downloads.push(Download {
                        url: f.url.clone(),
                        path: path.clone(),
                        sha1: Some(f.sha1.clone()),
                        size: Some(f.size),
                    });
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
