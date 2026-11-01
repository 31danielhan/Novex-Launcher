//! Interface updates without a new app release.
//!
//! A UI bundle is a zip of the built frontend plus `novex-ui.json` ({version, api}), signed
//! with the updater key. It is published on the rolling `ui-latest` GitHub release next to
//! `ui-bundle.json` ({version, api, signature}).
//!
//! A bundle is used only when its signature checks out, it was built for this app's command
//! API (`ui-api`), and it is newer than the interface built into the app. It is served from
//! memory in place of the embedded files, so nothing on disk is trusted after verification.
//! If a bundle fails to start (the page never reports in), the next launch drops it.

use std::borrow::Cow;
use std::collections::HashMap;
use std::io::Read;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};

use base64::Engine;
use minisign_verify::{PublicKey, Signature};
use reqwest::Client;
use semver::Version;
use serde::{Deserialize, Serialize};
use tauri::utils::assets::{AssetKey, AssetsIter, CspHash};
use tauri::{AppHandle, Assets, Runtime, State};

use super::{not_configured, repo};
use crate::error::{msg, Result};
use crate::platform::Paths;
use crate::AppState;

/// The command API the interface is written against. Bumped whenever commands change in a
/// way an older or newer interface can't handle; bundles must match it exactly.
pub fn api_level() -> u32 {
    include_str!("../../ui-api")
        .trim()
        .parse()
        .expect("ui-api holds a number")
}

/// Where the bundle manifest lives. NOVEX_UI_MANIFEST_URL overrides it for testing; bundles
/// still have to be signed with the app's key.
fn manifest_url() -> Result<String> {
    if let Ok(url) = std::env::var("NOVEX_UI_MANIFEST_URL") {
        return Ok(url);
    }
    Ok(format!(
        "https://github.com/{}/releases/download/ui-latest/ui-bundle.json",
        repo().ok_or_else(not_configured)?
    ))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Manifest {
    pub version: String,
    pub api: u32,
    /// Base64 minisign signature of the zip, as written by `tauri signer sign`.
    pub signature: String,
    /// Defaults to `ui-bundle.zip` next to the manifest.
    #[serde(default)]
    pub url: Option<String>,
}

/// Metadata inside the zip. It is covered by the signature, unlike the manifest, so it is
/// what compatibility is decided on.
#[derive(Debug, Deserialize)]
struct Inner {
    version: String,
    api: u32,
}

pub struct Bundle {
    pub version: String,
    files: HashMap<String, Vec<u8>>,
}

impl Bundle {
    /// A file by asset key, e.g. "/index.html".
    pub fn file(&self, key: &str) -> Option<&[u8]> {
        self.files.get(key).map(Vec::as_slice)
    }
}

/// The active bundle, shared by the asset provider and the commands.
#[derive(Clone, Default)]
pub struct UiState(Arc<RwLock<Option<Arc<Bundle>>>>);

impl UiState {
    pub fn version(&self) -> Option<String> {
        self.0.read().ok()?.as_ref().map(|b| b.version.clone())
    }

    fn set(&self, b: Option<Bundle>) {
        if let Ok(mut slot) = self.0.write() {
            *slot = b.map(Arc::new);
        }
    }
}

/// Serves the active bundle's files, or the embedded interface when there is none.
pub struct BundleAssets<R: Runtime> {
    embedded: Box<dyn Assets<R>>,
    ui: UiState,
}

impl<R: Runtime> BundleAssets<R> {
    pub fn new(embedded: Box<dyn Assets<R>>, ui: UiState) -> Self {
        Self { embedded, ui }
    }
}

impl<R: Runtime> Assets<R> for BundleAssets<R> {
    fn get(&self, key: &AssetKey) -> Option<Cow<'_, [u8]>> {
        let active = self.ui.0.read().ok().and_then(|b| b.clone());
        match active {
            // Never mix files of two interface versions.
            Some(b) => b.files.get(key.as_ref()).map(|f| Cow::Owned(f.clone())),
            None => self.embedded.get(key),
        }
    }

    fn iter(&self) -> Box<AssetsIter<'_>> {
        self.embedded.iter()
    }

    fn csp_hashes(&self, html_path: &AssetKey) -> Box<dyn Iterator<Item = CspHash<'_>> + '_> {
        self.embedded.csp_hashes(html_path)
    }
}

/// Placeholder used while swapping the embedded assets into [`BundleAssets`].
pub struct NoAssets;

impl<R: Runtime> Assets<R> for NoAssets {
    fn get(&self, _: &AssetKey) -> Option<Cow<'_, [u8]>> {
        None
    }

    fn iter(&self) -> Box<AssetsIter<'_>> {
        Box::new(std::iter::empty())
    }

    fn csp_hashes(&self, _: &AssetKey) -> Box<dyn Iterator<Item = CspHash<'_>> + '_> {
        Box::new(std::iter::empty())
    }
}

// ---- Storage -----------------------------------------------------------------------------

fn dir(paths: &Paths) -> PathBuf {
    paths.root.join("ui")
}

/// Present while a bundle is starting; removed once the page reports in.
fn marker(paths: &Paths) -> PathBuf {
    dir(paths).join("booting")
}

fn remove_stored(paths: &Paths) {
    let _ = std::fs::remove_dir_all(dir(paths));
}

fn decode_b64(s: &str) -> Result<String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(s.trim())
        .map_err(|_| msg("Invalid signature encoding."))?;
    String::from_utf8(bytes).map_err(|_| msg("Invalid signature encoding."))
}

/// Checks `zip` against the minisign `signature` (base64, as `tauri signer sign` writes it)
/// and the app's base64 public key.
pub fn verify(pubkey_b64: &str, zip: &[u8], signature_b64: &str) -> Result<()> {
    let key =
        PublicKey::decode(&decode_b64(pubkey_b64)?).map_err(|_| msg("Invalid public key."))?;
    let sig =
        Signature::decode(&decode_b64(signature_b64)?).map_err(|_| msg("Invalid signature."))?;
    key.verify(zip, &sig, true)
        .map_err(|_| msg("The interface update's signature is invalid."))
}

/// Unpacks a verified zip into memory and checks it fits this app.
fn unpack(zip: &[u8], app_version: &Version) -> Result<Bundle> {
    let mut archive = zip::ZipArchive::new(std::io::Cursor::new(zip))?;
    let mut files = HashMap::new();
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i)?;
        if entry.is_dir() {
            continue;
        }
        let Some(path) = entry.enclosed_name() else {
            return Err(msg("The interface bundle contains an unsafe path."));
        };
        let key = format!("/{}", path.to_string_lossy().replace('\\', "/"));
        let mut buf = Vec::with_capacity(entry.size() as usize);
        entry.read_to_end(&mut buf)?;
        files.insert(key, buf);
    }
    let inner: Inner = serde_json::from_slice(
        files
            .get("/novex-ui.json")
            .ok_or_else(|| msg("The interface bundle has no novex-ui.json."))?,
    )?;
    if !files.contains_key("/index.html") {
        return Err(msg("The interface bundle has no index.html."));
    }
    check_compatible(&inner.version, inner.api, app_version)?;
    Ok(Bundle {
        version: inner.version,
        files,
    })
}

fn check_compatible(version: &str, api: u32, app_version: &Version) -> Result<()> {
    if api != api_level() {
        return Err(msg(format!(
            "This interface update needs a newer launcher (API {api}, this one has {}).",
            api_level()
        )));
    }
    let v = Version::parse(version).map_err(|_| msg("Invalid interface version."))?;
    if &v <= app_version {
        return Err(msg("The built-in interface is already this new."));
    }
    Ok(())
}

fn pubkey<R: Runtime>(app: &AppHandle<R>) -> Option<String> {
    app.config()
        .plugins
        .0
        .get("updater")?
        .get("pubkey")?
        .as_str()
        .map(str::to_string)
}

fn app_version<R: Runtime>(app: &AppHandle<R>) -> Version {
    // Tauri's package version is a semver::Version already; convert via its string form.
    Version::parse(&app.package_info().version.to_string()).unwrap_or(Version::new(0, 0, 0))
}

/// The stored bundle if it is still valid. A bundle that didn't start last time, or that no
/// longer verifies or fits this app (e.g. after an app update), is deleted.
pub fn read_stored(paths: &Paths, pubkey: &str, app_version: &Version) -> Option<Bundle> {
    let d = dir(paths);
    if marker(paths).exists() {
        eprintln!(
            "Novex: the downloaded interface didn't start last time; using the built-in one."
        );
        remove_stored(paths);
        return None;
    }
    let zip = std::fs::read(d.join("bundle.zip")).ok()?;
    let sig = std::fs::read_to_string(d.join("bundle.zip.sig")).ok()?;
    match verify(pubkey, &zip, &sig).and_then(|()| unpack(&zip, app_version)) {
        Ok(bundle) => {
            let _ = std::fs::write(marker(paths), b"");
            Some(bundle)
        }
        Err(_) => {
            remove_stored(paths);
            None
        }
    }
}

/// Loads the stored bundle at startup. Dev builds always use the dev server.
pub fn load_stored<R: Runtime>(app: &AppHandle<R>, paths: &Paths, ui: &UiState) {
    if tauri::is_dev() {
        return;
    }
    if let Some(key) = pubkey(app) {
        ui.set(read_stored(paths, &key, &app_version(app)));
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UiUpdate {
    pub version: String,
}

async fn fetch_manifest(http: &Client) -> Result<(Manifest, String)> {
    let url = manifest_url()?;
    let resp = http.get(&url).send().await?;
    if resp.status() == reqwest::StatusCode::NOT_FOUND {
        return Err(msg("No interface updates have been published."));
    }
    let manifest: Manifest = resp.error_for_status()?.json().await?;
    let zip_url = match &manifest.url {
        Some(u) => u.clone(),
        None => match url.rsplit_once('/') {
            Some((base, _)) => format!("{base}/ui-bundle.zip"),
            None => return Err(msg("Invalid manifest URL.")),
        },
    };
    Ok((manifest, zip_url))
}

/// Whether a newer compatible interface is published than both the built-in one and
/// `active`. Decided on the manifest; `download` re-checks the signed contents.
pub async fn check(
    http: &Client,
    active: Option<&str>,
    app_version: &Version,
) -> Result<Option<UiUpdate>> {
    let (m, _) = match fetch_manifest(http).await {
        Ok(m) => m,
        Err(_) if repo().is_none() && std::env::var("NOVEX_UI_MANIFEST_URL").is_err() => {
            return Err(not_configured())
        }
        Err(e) => return Err(e),
    };
    let Ok(v) = Version::parse(&m.version) else {
        return Ok(None);
    };
    let current = active
        .and_then(|s| Version::parse(s).ok())
        .unwrap_or_else(|| app_version.clone());
    let newer = v > current && &v > app_version;
    Ok((newer && m.api == api_level()).then_some(UiUpdate { version: m.version }))
}

/// Downloads and verifies the published bundle and stores it for the next start.
pub async fn download(
    http: &Client,
    paths: &Paths,
    pubkey: &str,
    app_version: &Version,
) -> Result<Bundle> {
    let (m, zip_url) = fetch_manifest(http).await?;
    let zip = http
        .get(&zip_url)
        .send()
        .await?
        .error_for_status()?
        .bytes()
        .await?
        .to_vec();
    verify(pubkey, &zip, &m.signature)?;
    let bundle = unpack(&zip, app_version)?;

    let d = dir(paths);
    std::fs::create_dir_all(&d)?;
    std::fs::write(d.join("bundle.zip.part"), &zip)?;
    std::fs::write(d.join("bundle.zip.sig"), &m.signature)?;
    std::fs::rename(d.join("bundle.zip.part"), d.join("bundle.zip"))?;
    std::fs::write(marker(paths), b"")?;
    Ok(bundle)
}

/// The interface started: keep the bundle.
pub fn boot_ok(paths: &Paths) {
    let _ = std::fs::remove_file(marker(paths));
}

// ---- Commands ----------------------------------------------------------------------------

#[tauri::command]
pub async fn ui_update_check(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Option<UiUpdate>> {
    check(
        &state.http,
        state.ui.version().as_deref(),
        &app_version(&app),
    )
    .await
}

/// Downloads, verifies and activates the newest interface. The page reloads itself after.
#[tauri::command]
pub async fn ui_update_install(app: AppHandle, state: State<'_, AppState>) -> Result<String> {
    if tauri::is_dev() {
        return Err(msg("Interface updates are disabled in development builds."));
    }
    let key = pubkey(&app).ok_or_else(|| msg("No updater public key."))?;
    let bundle = download(&state.http, &state.paths, &key, &app_version(&app)).await?;
    let version = bundle.version.clone();
    state.ui.set(Some(bundle));
    Ok(version)
}

/// Called by the interface once it has rendered.
#[tauri::command]
pub fn ui_boot_ok(state: State<'_, AppState>) {
    boot_ok(&state.paths);
}

/// Goes back to the interface built into the app.
#[tauri::command]
pub fn ui_reset(state: State<'_, AppState>) {
    remove_stored(&state.paths);
    state.ui.set(None);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compatibility_needs_matching_api_and_newer_version() {
        let app = Version::new(0, 1, 0);
        assert!(check_compatible("0.1.1", api_level(), &app).is_ok());
        assert!(check_compatible("0.1.0", api_level(), &app).is_err());
        assert!(check_compatible("0.0.9", api_level(), &app).is_err());
        assert!(check_compatible("0.2.0", api_level() + 1, &app).is_err());
        assert!(check_compatible("nonsense", api_level(), &app).is_err());
    }

    #[test]
    fn garbage_signatures_are_rejected() {
        let key = include_str!("../../tauri.conf.json");
        let key = key
            .split("\"pubkey\": \"")
            .nth(1)
            .unwrap()
            .split('"')
            .next()
            .unwrap();
        assert!(verify(key, b"zip", "bm90IGEgc2lnbmF0dXJl").is_err());
        assert!(verify(key, b"zip", "%%%").is_err());
    }
}
