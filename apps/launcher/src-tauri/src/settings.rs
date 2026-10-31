//! Global launcher settings (per-instance overrides come in M3).

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::Result;
use crate::platform::Paths;
use crate::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub max_memory_mb: u32,
    /// Overrides the managed runtime when set.
    pub java_path: Option<String>,
    pub jvm_args: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            max_memory_mb: 4096,
            java_path: None,
            jvm_args: String::new(),
        }
    }
}

impl Settings {
    pub fn load(paths: &Paths) -> Self {
        std::fs::read(paths.root.join("settings.json"))
            .ok()
            .and_then(|b| serde_json::from_slice(&b).ok())
            .unwrap_or_default()
    }

    fn save(&self, paths: &Paths) -> Result<()> {
        std::fs::create_dir_all(&paths.root)?;
        std::fs::write(
            paths.root.join("settings.json"),
            serde_json::to_vec_pretty(self)?,
        )?;
        Ok(())
    }
}

#[tauri::command]
pub async fn settings_get(state: State<'_, AppState>) -> Result<Settings> {
    Ok(state.settings.lock().await.clone())
}

#[tauri::command]
pub async fn settings_set(state: State<'_, AppState>, settings: Settings) -> Result<Settings> {
    let mut s = settings;
    s.max_memory_mb = s.max_memory_mb.clamp(512, 65536);
    s.java_path = s.java_path.filter(|p| !p.trim().is_empty());
    s.save(&state.paths)?;
    *state.settings.lock().await = s.clone();
    Ok(s)
}
