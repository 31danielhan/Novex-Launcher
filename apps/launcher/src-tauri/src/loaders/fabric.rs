//! Fabric (with Legacy Fabric for pre-1.14) and Quilt. Both publish ready-made profile JSONs.

use reqwest::Client;
use serde::Deserialize;

use super::{LoaderKind, LoaderVersion};
use crate::downloads;
use crate::error::{msg, Result};
use crate::game::version::ProfileJson;
use crate::platform::Paths;

fn hosts(kind: LoaderKind) -> &'static [&'static str] {
    match kind {
        // Legacy Fabric covers 1.3–1.13.2 under the same API shape.
        LoaderKind::Fabric => &[
            "https://meta.fabricmc.net/v2",
            "https://meta.legacyfabric.net/v2",
        ],
        _ => &["https://meta.quiltmc.org/v3"],
    }
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

pub async fn versions(http: &Client, kind: LoaderKind, game: &str) -> Result<Vec<LoaderVersion>> {
    let mut network_err = None;
    for host in hosts(kind) {
        let url = format!("{host}/versions/loader/{game}");
        let mut list = match downloads::get_json::<Vec<Entry>>(http, &url).await {
            Ok(list) if !list.is_empty() => list,
            Ok(_) => continue,
            // A 4xx means "unknown game version" on this host; anything else is a real failure.
            Err(crate::error::Error::Http(e))
                if !e.status().is_some_and(|s| s.is_client_error()) =>
            {
                network_err = Some(crate::error::Error::Http(e));
                continue;
            }
            Err(_) => continue,
        };
        // Quilt's API isn't sorted; newest first everywhere.
        list.sort_by_key(|e| std::cmp::Reverse(super::version_key(&e.loader.version)));
        return Ok(list
            .into_iter()
            .map(|e| {
                let stable = e.loader.stable.unwrap_or(!e.loader.version.contains('-'));
                LoaderVersion {
                    label: e.loader.version.clone(),
                    id: e.loader.version,
                    stable,
                    recommended: false,
                }
            })
            .collect());
    }
    match network_err {
        Some(e) => Err(e),
        None => Ok(vec![]),
    }
}

pub async fn profile(
    http: &Client,
    paths: &Paths,
    kind: LoaderKind,
    game: &str,
    loader: &str,
) -> Result<ProfileJson> {
    let cache = paths.meta().join("loaders").join(format!(
        "{}-{game}-{loader}.json",
        kind.label().to_lowercase()
    ));
    let mut last_err = None;
    for host in hosts(kind) {
        let url = format!("{host}/versions/loader/{game}/{loader}/profile/json");
        match downloads::cached_json(http, &url, &cache, None).await {
            Ok(p) => return Ok(p),
            Err(e) => last_err = Some(e),
        }
    }
    Err(last_err.unwrap_or_else(|| {
        msg(format!(
            "{} {loader} isn't available for {game}.",
            kind.label()
        ))
    }))
}
