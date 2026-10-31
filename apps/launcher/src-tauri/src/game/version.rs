//! Mojang version manifest and version JSON (the recipe for launching one game version).

use std::collections::HashMap;

use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::downloads;
use crate::error::{msg, Result};
use crate::platform::{arch_matches, mojang_os, Paths};
use crate::AppState;

const MANIFEST_URL: &str = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

#[derive(Debug, Clone, Deserialize)]
pub struct VersionManifest {
    pub versions: Vec<ManifestEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestEntry {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(skip_serializing)]
    pub url: String,
    #[serde(skip_serializing)]
    pub sha1: String,
    pub release_time: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionJson {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub main_class: String,
    pub arguments: Option<Arguments>,
    pub minecraft_arguments: Option<String>,
    pub asset_index: AssetIndexRef,
    pub downloads: VersionDownloads,
    pub libraries: Vec<Library>,
    pub java_version: Option<JavaVersion>,
    pub logging: Option<Logging>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct FileRef {
    pub sha1: String,
    pub size: u64,
    pub url: String,
    pub path: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AssetIndexRef {
    pub id: String,
    pub sha1: String,
    pub url: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct VersionDownloads {
    pub client: FileRef,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Library {
    pub name: String,
    pub downloads: Option<LibraryDownloads>,
    #[serde(default)]
    pub rules: Vec<Rule>,
    /// Pre-1.19 style natives: OS name → classifier (may contain `${arch}`).
    pub natives: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LibraryDownloads {
    pub artifact: Option<FileRef>,
    pub classifiers: Option<HashMap<String, FileRef>>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct Arguments {
    #[serde(default)]
    pub game: Vec<Arg>,
    #[serde(default)]
    pub jvm: Vec<Arg>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
pub enum Arg {
    Plain(String),
    Conditional { rules: Vec<Rule>, value: ArgValue },
}

#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
pub enum ArgValue {
    One(String),
    Many(Vec<String>),
}

#[derive(Debug, Clone, Deserialize)]
pub struct Rule {
    pub action: String,
    pub os: Option<OsRule>,
    pub features: Option<HashMap<String, bool>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct OsRule {
    pub name: Option<String>,
    pub arch: Option<String>,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JavaVersion {
    pub component: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Logging {
    pub client: Option<LoggingClient>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LoggingClient {
    pub argument: String,
    pub file: LoggingFile,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LoggingFile {
    pub id: String,
    pub sha1: String,
    pub size: u64,
    pub url: String,
}

impl Rule {
    fn matches(&self) -> bool {
        if let Some(os) = &self.os {
            if os.name.as_deref().is_some_and(|n| n != mojang_os()) {
                return false;
            }
            if os.arch.as_deref().is_some_and(|a| !arch_matches(a)) {
                return false;
            }
            // Only used to single out ancient macOS releases; never matches today.
            if os.version.is_some() {
                return false;
            }
        }
        // Optional features (demo mode, custom resolution, quick play) are all off for now.
        if let Some(features) = &self.features {
            if features.values().any(|v| *v) {
                return false;
            }
        }
        true
    }
}

/// No rules means allowed; otherwise the last matching rule decides.
pub fn rules_allow(rules: &[Rule]) -> bool {
    if rules.is_empty() {
        return true;
    }
    let mut allowed = false;
    for r in rules {
        if r.matches() {
            allowed = r.action == "allow";
        }
    }
    allowed
}

impl Arg {
    pub fn values(&self) -> Vec<String> {
        match self {
            Arg::Plain(s) => vec![s.clone()],
            Arg::Conditional { rules, value } if rules_allow(rules) => match value {
                ArgValue::One(s) => vec![s.clone()],
                ArgValue::Many(v) => v.clone(),
            },
            Arg::Conditional { .. } => vec![],
        }
    }
}

impl VersionJson {
    pub fn java_component(&self) -> &str {
        self.java_version
            .as_ref()
            .map_or("jre-legacy", |j| j.component.as_str())
    }

    /// Versions before 1.19 ship no Apple Silicon natives and must run under Rosetta.
    pub fn has_arm64_mac_natives(&self) -> bool {
        self.libraries.iter().any(|l| {
            l.name.ends_with(":natives-macos-arm64")
                || l.downloads
                    .as_ref()
                    .and_then(|d| d.classifiers.as_ref())
                    .is_some_and(|c| c.contains_key("natives-macos-arm64"))
        })
    }
}

pub async fn manifest(client: &Client, paths: &Paths) -> Result<VersionManifest> {
    let cache = paths.meta().join("version_manifest_v2.json");
    let fetched = async {
        let raw = client
            .get(MANIFEST_URL)
            .send()
            .await?
            .error_for_status()?
            .bytes()
            .await?;
        let m: VersionManifest = serde_json::from_slice(&raw)?;
        tokio::fs::create_dir_all(paths.meta()).await?;
        tokio::fs::write(&cache, &raw).await?;
        Ok::<_, crate::error::Error>(m)
    }
    .await;
    match fetched {
        Ok(m) => Ok(m),
        // Offline: fall back to the last manifest we saw.
        Err(e) => match tokio::fs::read(&cache).await {
            Ok(bytes) => Ok(serde_json::from_slice(&bytes)?),
            Err(_) => Err(e),
        },
    }
}

pub async fn version_json(client: &Client, paths: &Paths, id: &str) -> Result<VersionJson> {
    let path = paths.versions().join(id).join(format!("{id}.json"));
    // Known versions launch offline from the cached JSON.
    if let Ok(bytes) = tokio::fs::read(&path).await {
        if let Ok(v) = serde_json::from_slice(&bytes) {
            return Ok(v);
        }
    }
    let m = manifest(client, paths).await?;
    let entry = m
        .versions
        .iter()
        .find(|v| v.id == id)
        .ok_or_else(|| msg(format!("Unknown Minecraft version {id}")))?;
    downloads::cached_json(client, &entry.url, &path, Some(&entry.sha1)).await
}

#[tauri::command]
pub async fn versions_list(state: State<'_, AppState>) -> Result<Vec<ManifestEntry>> {
    Ok(manifest(&state.http, &state.paths).await?.versions)
}
