//! Parallel, checksum-verified downloads.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

use futures_util::{stream, StreamExt, TryStreamExt};
use reqwest::Client;
use serde::de::DeserializeOwned;
use sha1::{Digest, Sha1};
use tokio::io::AsyncWriteExt;

use crate::error::{msg, Result};

const CONCURRENCY: usize = 16;
const RETRIES: usize = 3;

#[derive(Debug, Clone)]
pub struct Download {
    pub url: String,
    pub path: PathBuf,
    pub sha1: Option<String>,
    pub size: Option<u64>,
}

pub fn http_client() -> Client {
    Client::builder()
        .user_agent(concat!("NovexLauncher/", env!("CARGO_PKG_VERSION")))
        .connect_timeout(std::time::Duration::from_secs(15))
        .build()
        .expect("failed to build HTTP client")
}

/// A file counts as present when it exists with the expected size.
/// Hashes are checked when a file is downloaded, not on every launch, to keep startup fast.
async fn is_present(d: &Download) -> bool {
    match tokio::fs::metadata(&d.path).await {
        Ok(m) => d.size.map_or(true, |s| m.len() == s),
        Err(_) => false,
    }
}

async fn fetch_one(client: &Client, d: &Download) -> Result<()> {
    if let Some(parent) = d.path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    let tmp = d.path.with_extension("part");
    let mut last_err = None;
    for _ in 0..RETRIES {
        match try_fetch(client, d, &tmp).await {
            Ok(()) => {
                tokio::fs::rename(&tmp, &d.path).await?;
                return Ok(());
            }
            Err(e) => last_err = Some(e),
        }
    }
    let _ = tokio::fs::remove_file(&tmp).await;
    Err(last_err.unwrap_or_else(|| msg("download failed")))
}

async fn try_fetch(client: &Client, d: &Download, tmp: &Path) -> Result<()> {
    let resp = client.get(&d.url).send().await?.error_for_status()?;
    let mut file = tokio::fs::File::create(tmp).await?;
    let mut hasher = Sha1::new();
    let mut body = resp.bytes_stream();
    while let Some(chunk) = body.try_next().await? {
        hasher.update(&chunk);
        file.write_all(&chunk).await?;
    }
    file.flush().await?;
    if let Some(expected) = &d.sha1 {
        let got = hex::encode(hasher.finalize());
        if !got.eq_ignore_ascii_case(expected) {
            return Err(msg(format!("Checksum mismatch for {}", d.url)));
        }
    }
    Ok(())
}

/// Downloads every missing file. `on_progress(done, total)` counts only files that needed fetching.
pub async fn fetch_all<F>(client: &Client, items: Vec<Download>, on_progress: F) -> Result<()>
where
    F: Fn(usize, usize) + Send + Sync,
{
    let mut missing = Vec::new();
    for d in items {
        if !is_present(&d).await {
            missing.push(d);
        }
    }
    let total = missing.len();
    on_progress(0, total);
    if total == 0 {
        return Ok(());
    }
    let done = Arc::new(AtomicUsize::new(0));
    let step = (total / 100).max(1);
    stream::iter(missing)
        .map(|d| {
            let done = done.clone();
            let on_progress = &on_progress;
            async move {
                fetch_one(client, &d).await?;
                let n = done.fetch_add(1, Ordering::Relaxed) + 1;
                if n == total || n % step == 0 {
                    on_progress(n, total);
                }
                Ok::<_, crate::error::Error>(())
            }
        })
        .buffer_unordered(CONCURRENCY)
        .try_collect::<Vec<()>>()
        .await?;
    Ok(())
}

pub async fn get_json<T: DeserializeOwned>(client: &Client, url: &str) -> Result<T> {
    Ok(client
        .get(url)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?)
}

/// Fetches a JSON file into `path` (verified by sha1 when given) and parses it.
/// Reuses the local copy when it is already there, so known files work offline.
pub async fn cached_json<T: DeserializeOwned>(
    client: &Client,
    url: &str,
    path: &Path,
    sha1: Option<&str>,
) -> Result<T> {
    if let Ok(bytes) = tokio::fs::read(path).await {
        let fresh = match sha1 {
            Some(expected) => hex::encode(Sha1::digest(&bytes)).eq_ignore_ascii_case(expected),
            None => true,
        };
        if fresh {
            if let Ok(v) = serde_json::from_slice(&bytes) {
                return Ok(v);
            }
        }
    }
    let d = Download {
        url: url.to_string(),
        path: path.to_path_buf(),
        sha1: sha1.map(str::to_string),
        size: None,
    };
    fetch_one(client, &d).await?;
    Ok(serde_json::from_slice(&tokio::fs::read(path).await?)?)
}
