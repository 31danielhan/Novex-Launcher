//! Updates from GitHub Releases, in two channels:
//! - the app itself, through Tauri's updater (`latest.json` on the newest release);
//! - the interface alone, as a signed UI bundle (see [`ui`]).
//!
//! Both are signed with the same minisign key; the public half is in `tauri.conf.json`.

pub mod ui;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_updater::{Update, UpdaterExt};
use tokio::sync::Mutex;

use crate::error::{msg, Result};
use crate::AppState;

/// The GitHub repository releases come from ("owner/name"). Set NOVEX_UPDATE_REPO at build
/// time; GitHub Actions builds fall back to the repository they run in.
pub fn repo() -> Option<&'static str> {
    option_env!("NOVEX_UPDATE_REPO")
        .or(option_env!("GITHUB_REPOSITORY"))
        .filter(|r| r.contains('/'))
}

fn not_configured() -> crate::error::Error {
    msg("Updates aren't set up in this build (no GitHub repository was set when it was built).")
}

/// Where the app's `latest.json` lives. NOVEX_UPDATE_ENDPOINT overrides it for testing;
/// that's safe because every update must still carry a valid signature.
fn app_endpoint() -> Result<String> {
    if let Ok(url) = std::env::var("NOVEX_UPDATE_ENDPOINT") {
        return Ok(url);
    }
    Ok(format!(
        "https://github.com/{}/releases/latest/download/latest.json",
        repo().ok_or_else(not_configured)?
    ))
}

/// The update found by the last check, kept so installing doesn't check again.
#[derive(Default)]
pub struct Pending(pub Mutex<Option<Update>>);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdate {
    pub version: String,
    pub current_version: String,
    pub notes: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProgressEvent {
    downloaded: u64,
    total: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub app_version: String,
    /// Whether this build knows where to look for updates.
    pub configured: bool,
    /// Version of the downloaded interface in use, if any.
    pub ui_version: Option<String>,
}

#[tauri::command]
pub fn update_info(app: AppHandle, state: State<'_, AppState>) -> UpdateInfo {
    UpdateInfo {
        app_version: app.package_info().version.to_string(),
        configured: repo().is_some()
            || std::env::var("NOVEX_UPDATE_ENDPOINT").is_ok()
            || std::env::var("NOVEX_UI_MANIFEST_URL").is_ok(),
        ui_version: state.ui.version(),
    }
}

#[tauri::command]
pub async fn app_update_check(app: AppHandle) -> Result<Option<AppUpdate>> {
    let url = app_endpoint()?
        .parse()
        .map_err(|_| msg("Invalid update URL."))?;
    let update = app
        .updater_builder()
        .endpoints(vec![url])
        .map_err(|e| msg(e.to_string()))?
        .build()
        .map_err(|e| msg(e.to_string()))?
        .check()
        .await
        .map_err(|e| msg(format!("Couldn't check for updates: {e}")))?;
    let info = update.as_ref().map(|u| AppUpdate {
        version: u.version.clone(),
        current_version: u.current_version.clone(),
        notes: u.body.clone(),
    });
    *app.state::<Pending>().0.lock().await = update;
    Ok(info)
}

/// Downloads, verifies and installs the update found by the last check, then restarts.
#[tauri::command]
pub async fn app_update_install(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    if !state.running.lock().await.is_empty() {
        return Err(msg("Close Minecraft before updating the launcher."));
    }
    let update = app
        .state::<Pending>()
        .0
        .lock()
        .await
        .take()
        .ok_or_else(|| msg("No update is waiting. Check for updates first."))?;
    let mut downloaded = 0u64;
    let emitter = app.clone();
    update
        .download_and_install(
            |chunk, total| {
                downloaded += chunk as u64;
                let _ = emitter.emit("app-update-progress", ProgressEvent { downloaded, total });
            },
            || {},
        )
        .await
        .map_err(|e| msg(format!("The update failed: {e}")))?;
    app.restart()
}
