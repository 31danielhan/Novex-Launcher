//! Java runtimes from Mojang's runtime manifest, installed per component and platform.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use reqwest::Client;
use serde::Deserialize;

use crate::downloads::{self, Download};
use crate::error::{msg, Result};
use crate::platform::{set_executable, Paths};

const RUNTIME_INDEX: &str = "https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json";
const MARKER: &str = ".novex-manifest";

#[derive(Deserialize)]
struct FileRef {
    sha1: String,
    size: u64,
    url: String,
}

#[derive(Deserialize)]
struct ManifestRef {
    sha1: String,
    url: String,
}

#[derive(Deserialize)]
struct RuntimeEntry {
    manifest: ManifestRef,
}

type RuntimeIndex = HashMap<String, HashMap<String, Vec<RuntimeEntry>>>;

#[derive(Deserialize)]
struct RuntimeManifest {
    files: HashMap<String, RuntimeFile>,
}

#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
enum RuntimeFile {
    Directory,
    File {
        #[serde(default)]
        executable: bool,
        downloads: RuntimeDownloads,
    },
    Link {
        #[cfg_attr(not(unix), allow(dead_code))]
        target: String,
    },
}

#[derive(Deserialize)]
struct RuntimeDownloads {
    raw: FileRef,
}

/// Mojang's platform keys, best match first. Apple Silicon falls back to Intel builds
/// (run through Rosetta) for runtimes and game versions without ARM support.
fn platform_keys(force_x64: bool) -> Vec<&'static str> {
    match (std::env::consts::OS, std::env::consts::ARCH) {
        ("macos", "aarch64") if !force_x64 => vec!["mac-os-arm64", "mac-os"],
        ("macos", _) => vec!["mac-os"],
        ("windows", "aarch64") => vec!["windows-arm64", "windows-x64"],
        ("windows", "x86_64") => vec!["windows-x64"],
        ("windows", "x86") => vec!["windows-x86"],
        ("linux", "x86_64") => vec!["linux"],
        ("linux", "x86") => vec!["linux-i386"],
        _ => vec![],
    }
}

fn java_exe(dir: &Path) -> PathBuf {
    if cfg!(target_os = "macos") {
        dir.join("jre.bundle/Contents/Home/bin/java")
    } else if cfg!(windows) {
        dir.join("bin").join("javaw.exe")
    } else {
        dir.join("bin").join("java")
    }
}

/// Makes sure the runtime `component` (e.g. "java-runtime-delta") is installed and returns its java binary.
pub async fn ensure_runtime<F>(
    client: &Client,
    paths: &Paths,
    component: &str,
    force_x64: bool,
    on_progress: F,
) -> Result<PathBuf>
where
    F: Fn(usize, usize) + Send + Sync,
{
    let index: RuntimeIndex = match downloads::get_json(client, RUNTIME_INDEX).await {
        Ok(i) => i,
        // Offline: use whatever is already installed.
        Err(e) => return find_installed(paths, component, force_x64).ok_or(e),
    };

    let (platform, entry) = platform_keys(force_x64)
        .into_iter()
        .find_map(|p| {
            index
                .get(p)
                .and_then(|c| c.get(component))
                .and_then(|v| v.first())
                .map(|e| (p, e))
        })
        .ok_or_else(|| {
            msg(format!(
                "No bundled Java ({component}) for this platform yet. Set a custom Java path in Settings."
            ))
        })?;

    let dir = paths.runtimes().join(component).join(platform);
    let marker = dir.join(MARKER);
    if tokio::fs::read_to_string(&marker).await.ok().as_deref()
        == Some(entry.manifest.sha1.as_str())
    {
        return Ok(java_exe(&dir));
    }

    let manifest: RuntimeManifest = downloads::cached_json(
        client,
        &entry.manifest.url,
        &paths
            .meta()
            .join("runtimes")
            .join(format!("{component}-{platform}.json")),
        Some(&entry.manifest.sha1),
    )
    .await?;

    let mut files = Vec::new();
    let mut executables = Vec::new();
    for (rel, f) in &manifest.files {
        let path = dir.join(rel);
        match f {
            RuntimeFile::Directory => tokio::fs::create_dir_all(&path).await?,
            RuntimeFile::File {
                executable,
                downloads: d,
            } => {
                if *executable {
                    executables.push(path.clone());
                }
                files.push(Download {
                    url: d.raw.url.clone(),
                    path,
                    sha1: Some(d.raw.sha1.clone()),
                    size: Some(d.raw.size),
                });
            }
            RuntimeFile::Link { .. } => {}
        }
    }
    downloads::fetch_all(client, files, on_progress).await?;

    for exe in executables {
        set_executable(&exe)?;
    }
    #[cfg(unix)]
    for (rel, f) in &manifest.files {
        if let RuntimeFile::Link { target } = f {
            let link = dir.join(rel);
            let _ = tokio::fs::remove_file(&link).await;
            tokio::fs::symlink(target, &link).await?;
        }
    }

    tokio::fs::write(&marker, &entry.manifest.sha1).await?;
    Ok(java_exe(&dir))
}

fn find_installed(paths: &Paths, component: &str, force_x64: bool) -> Option<PathBuf> {
    platform_keys(force_x64).into_iter().find_map(|p| {
        let dir = paths.runtimes().join(component).join(p);
        let exe = java_exe(&dir);
        (dir.join(MARKER).exists() && exe.exists()).then_some(exe)
    })
}
