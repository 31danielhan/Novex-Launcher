//! OS / architecture detection and per-OS data locations.
//!
//! Data lives apart from the app install so reinstalling never touches instances:
//! - Windows: %APPDATA%\Novex
//! - macOS:   ~/Library/Application Support/Novex
//! - Linux:   $XDG_DATA_HOME/novex (or ~/.local/share/novex)

use serde::Serialize;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    pub app_version: String,
    /// "windows" | "macos" | "linux"
    pub os: &'static str,
    /// "x86_64" | "aarch64"
    pub arch: &'static str,
    pub data_dir: String,
}

pub fn data_dir(app: &tauri::AppHandle) -> tauri::Result<PathBuf> {
    // Lowercase on Linux to follow XDG conventions.
    let name = if cfg!(target_os = "linux") {
        "novex"
    } else {
        "Novex"
    };
    Ok(app.path().data_dir()?.join(name))
}

#[tauri::command]
pub fn system_info(app: tauri::AppHandle) -> Result<SystemInfo, String> {
    let dir = data_dir(&app).map_err(|e| e.to_string())?;
    Ok(SystemInfo {
        app_version: app.package_info().version.to_string(),
        os: std::env::consts::OS,
        arch: std::env::consts::ARCH,
        data_dir: dir.to_string_lossy().into_owned(),
    })
}
