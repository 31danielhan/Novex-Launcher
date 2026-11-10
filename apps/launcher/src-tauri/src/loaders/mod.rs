//! Mod loaders. Each produces a profile that is merged onto the vanilla version.

mod fabric;
mod forge;
mod ornithe;

use std::path::Path;

use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::{msg, Result};
use crate::game::version::{self, VersionJson};
use crate::platform::Paths;
use crate::AppState;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LoaderKind {
    #[default]
    Vanilla,
    Fabric,
    Quilt,
    Forge,
    NeoForge,
    /// Fabric Loader for old versions such as 1.8.9.
    Ornithe,
}

impl LoaderKind {
    pub fn label(self) -> &'static str {
        match self {
            LoaderKind::Vanilla => "Vanilla",
            LoaderKind::Fabric => "Fabric",
            LoaderKind::Quilt => "Quilt",
            LoaderKind::Forge => "Forge",
            LoaderKind::NeoForge => "NeoForge",
            LoaderKind::Ornithe => "Ornithe",
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoaderVersion {
    /// Passed back to install; for Forge this is the full Maven version ("1.20.1-47.3.0").
    pub id: String,
    pub label: String,
    pub stable: bool,
    pub recommended: bool,
}

/// Numeric sort key for versions like "47.3.0", "11.15.1.2318" or "0.20.0-beta.9".
/// Pre-releases sort below the matching release.
fn version_key(v: &str) -> (Vec<u64>, bool) {
    let (main, pre) = v.split_once('-').map_or((v, None), |(m, p)| (m, Some(p)));
    let nums = main
        .split(|c: char| !c.is_ascii_digit())
        .filter_map(|p| p.parse().ok())
        .collect();
    (
        nums,
        pre.map_or(true, |p| {
            !p.contains("beta") && !p.contains("alpha") && !p.contains("rc")
        }),
    )
}

/// Loader versions for a game version, newest first. Empty when the loader doesn't support it.
pub async fn versions(http: &Client, kind: LoaderKind, game: &str) -> Result<Vec<LoaderVersion>> {
    let mut list = match kind {
        LoaderKind::Vanilla => vec![],
        LoaderKind::Fabric | LoaderKind::Quilt => fabric::versions(http, kind, game).await?,
        LoaderKind::Forge => forge::forge_versions(http, game).await?,
        LoaderKind::NeoForge => forge::neoforge_versions(http, game).await?,
        LoaderKind::Ornithe => ornithe::versions(http, game).await?,
    };
    // Default pick goes first: recommended, else newest stable.
    if let Some(i) = list
        .iter()
        .position(|v| v.recommended)
        .or_else(|| list.iter().position(|v| v.stable))
    {
        let pick = list.remove(i);
        list.insert(0, pick);
    }
    Ok(list)
}

/// Maps a loader version as modpacks write it ("47.3.0", "0.16.5") to the id `install`
/// expects (Forge ids are full Maven versions like "1.20.1-47.3.0").
pub async fn find_version(
    http: &Client,
    kind: LoaderKind,
    game: &str,
    wanted: &str,
) -> Result<String> {
    if matches!(
        kind,
        LoaderKind::Fabric | LoaderKind::Quilt | LoaderKind::Ornithe | LoaderKind::Vanilla
    ) {
        return Ok(wanted.to_string());
    }
    versions(http, kind, game)
        .await?
        .into_iter()
        .find(|v| v.id == wanted || v.label == wanted)
        .map(|v| v.id)
        .ok_or_else(|| {
            msg(format!(
                "{} {wanted} isn't available for Minecraft {game}.",
                kind.label()
            ))
        })
}

/// Resolves the full launch version: vanilla alone, or vanilla merged with the loader profile
/// (installing the loader first if needed). `java` runs Forge's installer steps.
pub async fn resolve<P>(
    http: &Client,
    paths: &Paths,
    vanilla: VersionJson,
    kind: LoaderKind,
    loader_version: Option<&str>,
    java: &Path,
    progress: &P,
) -> Result<VersionJson>
where
    P: Fn(&str, usize, usize) + Send + Sync,
{
    if kind == LoaderKind::Vanilla {
        return Ok(vanilla);
    }
    let lv = loader_version
        .filter(|v| !v.is_empty())
        .ok_or_else(|| msg(format!("No {} version selected.", kind.label())))?;
    progress(&format!("Installing {}", kind.label()), 0, 0);
    let profile = match kind {
        LoaderKind::Fabric | LoaderKind::Quilt => {
            fabric::profile(http, paths, kind, &vanilla.id, lv).await?
        }
        LoaderKind::Forge | LoaderKind::NeoForge => {
            forge::install(http, paths, kind, lv, &vanilla, java, progress).await?
        }
        LoaderKind::Ornithe => ornithe::profile(http, paths, &vanilla.id, lv).await?,
        LoaderKind::Vanilla => unreachable!(),
    };
    let mut merged = version::merge(vanilla, profile);
    if cfg!(target_os = "macos") && kind == LoaderKind::Forge {
        forge::patch_lwjgl2_for_macos(&mut merged);
    }
    Ok(merged)
}

/// The Java runtime a loader asks for instead of the game version's own, if any. Ornithe's
/// profiles from Polyfrost run old versions on Java 25. `None` keeps the vanilla choice.
pub async fn java_component(
    http: &Client,
    paths: &Paths,
    kind: LoaderKind,
    game: &str,
    loader_version: Option<&str>,
) -> Option<String> {
    if kind != LoaderKind::Ornithe {
        return None;
    }
    let lv = loader_version.filter(|v| !v.is_empty())?;
    let profile = ornithe::profile(http, paths, game, lv).await.ok()?;
    profile.java_version.map(|j| j.component)
}

#[tauri::command]
pub async fn loader_versions(
    state: State<'_, AppState>,
    kind: LoaderKind,
    game: String,
) -> Result<Vec<LoaderVersion>> {
    versions(&state.http, kind, &game).await
}
