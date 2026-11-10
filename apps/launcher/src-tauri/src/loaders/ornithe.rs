//! Ornithe: Fabric Loader for old Minecraft versions (1.14.4 and older), such as 1.8.9.
//!
//! Profiles come from Polyfrost's metadata, the same ones OneClient (github.com/Polyfrost/OneLauncher)
//! launches with: they run the game on Java 25 with newer logging libraries and Legacy Fabric's
//! LWJGL 2, which has Apple Silicon natives, so old versions run natively instead of through
//! Rosetta. Ornithe's own metadata is the fallback, which keeps the game's old Java.

use reqwest::Client;
use serde::Deserialize;

use super::LoaderVersion;
use crate::downloads;
use crate::error::Result;
use crate::game::version::ProfileJson;
use crate::platform::Paths;

const POLYFROST: &str = "https://meta.polyfrost.org/ornithe/v1/manifest.json";
const ORNITHE: &str = "https://meta.ornithemc.net/v3/versions/gen2/fabric-loader";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Manifest {
    game_versions: Vec<GameVersion>,
}

#[derive(Deserialize)]
struct GameVersion {
    id: String,
    loaders: Vec<ManifestLoader>,
}

#[derive(Deserialize)]
struct ManifestLoader {
    id: String,
    url: String,
    #[serde(default)]
    stable: bool,
}

#[derive(Deserialize)]
struct Entry {
    loader: Loader,
}

#[derive(Deserialize)]
struct Loader {
    version: String,
    stable: Option<bool>,
}

async fn polyfrost(http: &Client, game: &str) -> Result<Vec<ManifestLoader>> {
    let m: Manifest = downloads::get_json(http, POLYFROST).await?;
    Ok(m.game_versions
        .into_iter()
        .find(|g| g.id == game)
        .map(|g| g.loaders)
        .unwrap_or_default())
}

pub async fn versions(http: &Client, game: &str) -> Result<Vec<LoaderVersion>> {
    let mut list: Vec<(String, bool)> = match polyfrost(http, game).await {
        Ok(l) if !l.is_empty() => l.into_iter().map(|l| (l.id, l.stable)).collect(),
        _ => match downloads::get_json::<Vec<Entry>>(http, &format!("{ORNITHE}/{game}")).await {
            Ok(l) => l
                .into_iter()
                .map(|e| {
                    let stable = e.loader.stable.unwrap_or(!e.loader.version.contains('-'));
                    (e.loader.version, stable)
                })
                .collect(),
            // A 4xx means Ornithe doesn't cover this version.
            Err(crate::error::Error::Http(e))
                if e.status().is_some_and(|s| s.is_client_error()) =>
            {
                vec![]
            }
            Err(e) => return Err(e),
        },
    };
    list.sort_by_key(|(v, _)| std::cmp::Reverse(super::version_key(v)));
    Ok(list
        .into_iter()
        .map(|(v, stable)| LoaderVersion {
            label: v.clone(),
            id: v,
            stable,
            recommended: false,
        })
        .collect())
}

pub async fn profile(
    http: &Client,
    paths: &Paths,
    game: &str,
    loader: &str,
) -> Result<ProfileJson> {
    let dir = paths.meta().join("loaders");
    // Each source keeps its own cache, so a fallback once doesn't stick.
    let polyfrost_cache = dir.join(format!("ornithe-polyfrost-{game}-{loader}.json"));
    let ornithe_cache = dir.join(format!("ornithe-{game}-{loader}.json"));
    let polyfrost_url = polyfrost(http, game)
        .await
        .ok()
        .and_then(|l| l.into_iter().find(|l| l.id == loader).map(|l| l.url));
    let mut last_err = None;
    match polyfrost_url {
        Some(url) => match downloads::cached_json(http, &url, &polyfrost_cache, None).await {
            Ok(p) => return Ok(p),
            Err(e) => last_err = Some(e),
        },
        // Offline: Polyfrost's profile from an earlier launch.
        None => {
            if let Some(p) = std::fs::read(&polyfrost_cache)
                .ok()
                .and_then(|b| serde_json::from_slice(&b).ok())
            {
                return Ok(p);
            }
        }
    }
    let url = format!("{ORNITHE}/{game}/{loader}/profile/json");
    match downloads::cached_json(http, &url, &ornithe_cache, None).await {
        Ok(p) => Ok(p),
        Err(e) => Err(last_err.unwrap_or(e)),
    }
}
