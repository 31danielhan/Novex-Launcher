//! Java runtimes from Mojang's runtime manifest, installed per component and platform.
//!
//! Where Mojang has no Java for this computer (Linux on ARM, for example), the same Java version
//! comes from Eclipse Temurin (Adoptium) instead, checked against its published SHA-256.

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
        Err(e) => {
            return find_installed(paths, component, force_x64)
                .or_else(|| temurin_installed(paths, component))
                .ok_or(e)
        }
    };

    let found = platform_keys(force_x64).into_iter().find_map(|p| {
        index
            .get(p)
            .and_then(|c| c.get(component))
            .and_then(|v| v.first())
            .map(|e| (p, e))
    });
    let Some((platform, entry)) = found else {
        return temurin(client, paths, component, &on_progress).await;
    };

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

/// The Java major version each of Mojang's runtime components stands for.
pub fn major_version(component: &str) -> Option<u32> {
    Some(match component {
        "jre-legacy" => 8,
        "java-runtime-alpha" => 16,
        "java-runtime-beta" | "java-runtime-gamma" | "java-runtime-gamma-snapshot" => 17,
        "java-runtime-delta" => 21,
        "java-runtime-epsilon" => 25,
        _ => {
            // Newer components follow the same idea; fall back to a number in the name if any.
            return component.rsplit('-').find_map(|p| p.parse().ok());
        }
    })
}

/// Adoptium's names for this computer.
fn adoptium_platform() -> Option<(&'static str, &'static str)> {
    let os = match std::env::consts::OS {
        "macos" => "mac",
        "windows" => "windows",
        "linux" => "linux",
        _ => return None,
    };
    let arch = match std::env::consts::ARCH {
        "x86_64" => "x64",
        "aarch64" => "aarch64",
        "x86" => "x32",
        "arm" => "arm",
        _ => return None,
    };
    Some((os, arch))
}

fn temurin_dir(paths: &Paths, major: u32) -> Option<PathBuf> {
    let (os, arch) = adoptium_platform()?;
    Some(
        paths
            .runtimes()
            .join(format!("temurin-{major}"))
            .join(format!("{os}-{arch}")),
    )
}

/// The java binary somewhere under an unpacked Temurin archive.
fn find_java(dir: &Path) -> Option<PathBuf> {
    let name = if cfg!(windows) { "javaw.exe" } else { "java" };
    let mut stack = vec![dir.to_path_buf()];
    while let Some(d) = stack.pop() {
        for e in std::fs::read_dir(&d).ok()?.flatten() {
            let p = e.path();
            if p.is_dir() {
                stack.push(p);
            } else if p.file_name().is_some_and(|n| n == name)
                && p.parent()
                    .and_then(|b| b.file_name())
                    .is_some_and(|b| b == "bin")
            {
                return Some(p);
            }
        }
    }
    None
}

fn temurin_installed(paths: &Paths, component: &str) -> Option<PathBuf> {
    let dir = temurin_dir(paths, major_version(component)?)?;
    dir.join(MARKER).exists().then(|| find_java(&dir)).flatten()
}

/// Java from Eclipse Temurin, for computers Mojang has no Java for. Java 16 is long gone, so
/// it's covered by 17, which runs the same Minecraft versions.
async fn temurin<F>(
    client: &Client,
    paths: &Paths,
    component: &str,
    on_progress: &F,
) -> Result<PathBuf>
where
    F: Fn(usize, usize) + Send + Sync,
{
    use futures_util::StreamExt;
    use sha2::{Digest, Sha256};

    let no_java = || {
        msg(format!(
            "No Java ({component}) is available for this computer. Set a custom Java path in Settings."
        ))
    };
    let wanted = major_version(component).ok_or_else(no_java)?;
    let (os, arch) = adoptium_platform().ok_or_else(no_java)?;
    let majors: &[u32] = if wanted == 16 { &[16, 17] } else { &[wanted] };

    let mut package = None;
    let mut major = wanted;
    for &m in majors {
        let url = format!(
            "https://api.adoptium.net/v3/assets/latest/{m}/hotspot?architecture={arch}&image_type=jre&os={os}&vendor=eclipse"
        );
        let list: serde_json::Value = downloads::get_json(client, &url).await?;
        if let Some(p) = list.get(0).map(|r| r["binary"]["package"].clone()) {
            package = Some(p);
            major = m;
            break;
        }
    }
    let package = package.ok_or_else(no_java)?;
    let link = package["link"].as_str().ok_or_else(no_java)?;
    let checksum = package["checksum"]
        .as_str()
        .ok_or_else(no_java)?
        .to_ascii_lowercase();
    let name = package["name"].as_str().unwrap_or_default().to_string();
    if !link.starts_with("https://github.com/adoptium/") {
        return Err(msg(
            "Java's download link isn't on Adoptium's GitHub, so it wasn't used.",
        ));
    }

    let dir = temurin_dir(paths, major).ok_or_else(no_java)?;
    let marker = dir.join(MARKER);
    if tokio::fs::read_to_string(&marker).await.ok().as_deref() == Some(checksum.as_str()) {
        if let Some(java) = find_java(&dir) {
            return Ok(java);
        }
    }

    // Progress in megabytes, so the numbers stay readable.
    let response = client.get(link).send().await?.error_for_status()?;
    let total = response.content_length().unwrap_or(0) as usize;
    let mut bytes = Vec::with_capacity(total);
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        bytes.extend_from_slice(&chunk?);
        on_progress(bytes.len() >> 20, total >> 20);
    }
    if hex::encode(Sha256::digest(&bytes)) != checksum {
        return Err(msg(
            "Java's download didn't match its checksum, so it wasn't used.",
        ));
    }

    let _ = tokio::fs::remove_dir_all(&dir).await;
    tokio::fs::create_dir_all(&dir).await?;
    let target = dir.clone();
    tokio::task::spawn_blocking(move || -> Result<()> {
        if name.ends_with(".zip") {
            zip::ZipArchive::new(std::io::Cursor::new(bytes))?.extract(&target)?;
        } else {
            tar::Archive::new(flate2::read::GzDecoder::new(&bytes[..])).unpack(&target)?;
        }
        Ok(())
    })
    .await
    .map_err(|e| msg(e.to_string()))??;

    let java =
        find_java(&dir).ok_or_else(|| msg("Java was downloaded but its program wasn't found."))?;
    set_executable(&java)?;
    tokio::fs::write(&marker, &checksum).await?;
    Ok(java)
}

#[cfg(test)]
mod tests {
    use super::major_version;

    #[test]
    fn components_map_to_java_versions() {
        assert_eq!(major_version("jre-legacy"), Some(8));
        assert_eq!(major_version("java-runtime-gamma"), Some(17));
        assert_eq!(major_version("java-runtime-delta"), Some(21));
        assert_eq!(major_version("java-runtime-epsilon"), Some(25));
        assert_eq!(major_version("java-runtime-27"), Some(27));
        assert_eq!(major_version("mystery"), None);
    }
}
