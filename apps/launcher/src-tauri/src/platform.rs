//! OS / architecture detection and per-OS data locations.
//!
//! Data lives apart from the app install so reinstalling never touches instances:
//! - Windows: %APPDATA%\Novex
//! - macOS:   ~/Library/Application Support/Novex
//! - Linux:   $XDG_DATA_HOME/novex (or ~/.local/share/novex)

use serde::Serialize;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

use crate::AppState;

/// Shared game files live once under the data root; instances only hold their own game dir.
#[derive(Debug, Clone)]
pub struct Paths {
    pub root: PathBuf,
}

impl Paths {
    pub fn resolve(app: &tauri::AppHandle) -> tauri::Result<Self> {
        // Lowercase on Linux to follow XDG conventions.
        let name = if cfg!(target_os = "linux") {
            "novex"
        } else {
            "Novex"
        };
        Ok(Self {
            root: app.path().data_dir()?.join(name),
        })
    }

    pub fn meta(&self) -> PathBuf {
        self.root.join("meta")
    }
    pub fn versions(&self) -> PathBuf {
        self.root.join("versions")
    }
    pub fn libraries(&self) -> PathBuf {
        self.root.join("libraries")
    }
    pub fn assets(&self) -> PathBuf {
        self.root.join("assets")
    }
    pub fn runtimes(&self) -> PathBuf {
        self.root.join("runtimes")
    }
    pub fn instances(&self) -> PathBuf {
        self.root.join("instances")
    }
}

/// OS name as used in Mojang's version rules.
pub fn mojang_os() -> &'static str {
    match std::env::consts::OS {
        "macos" => "osx",
        "windows" => "windows",
        _ => "linux",
    }
}

/// Matches a rule's `os.arch` value against the running CPU.
pub fn arch_matches(rule_arch: &str) -> bool {
    match rule_arch {
        "x86" => std::env::consts::ARCH == "x86",
        "x86_64" | "amd64" => std::env::consts::ARCH == "x86_64",
        "arm64" | "aarch64" => std::env::consts::ARCH == "aarch64",
        _ => false,
    }
}

pub fn classpath_separator() -> &'static str {
    if cfg!(windows) {
        ";"
    } else {
        ":"
    }
}

pub fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

#[cfg(unix)]
pub fn set_executable(path: &Path) -> std::io::Result<()> {
    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o755))
}

#[cfg(not(unix))]
pub fn set_executable(_path: &Path) -> std::io::Result<()> {
    Ok(())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    pub app_version: String,
    /// "windows" | "macos" | "linux"
    pub os: &'static str,
    /// "x86_64" | "aarch64"
    pub arch: &'static str,
    pub data_dir: String,
    /// Debug builds unlock dev-only features such as offline accounts.
    pub dev_build: bool,
}

#[tauri::command]
pub fn system_info(app: tauri::AppHandle, state: tauri::State<'_, AppState>) -> SystemInfo {
    SystemInfo {
        app_version: app.package_info().version.to_string(),
        os: std::env::consts::OS,
        arch: std::env::consts::ARCH,
        data_dir: state.paths.root.to_string_lossy().into_owned(),
        dev_build: cfg!(debug_assertions),
    }
}

#[tauri::command]
pub fn open_path(app: tauri::AppHandle, path: String) -> crate::error::Result<()> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_path(path, None::<&str>)
        .map_err(|e| crate::error::msg(e.to_string()))
}
