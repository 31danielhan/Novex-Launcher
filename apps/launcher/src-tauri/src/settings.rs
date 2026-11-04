//! Global launcher settings (per-instance overrides come in M3).

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::Result;
use crate::game_options::{GameOptions, TemplateInfo};
use crate::platform::Paths;
use crate::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub max_memory_mb: u32,
    /// Overrides the managed runtime when set.
    pub java_path: Option<String>,
    pub jvm_args: String,
    /// Install launcher and interface updates from GitHub at startup.
    pub auto_update: bool,
    /// CurseForge API key from console.curseforge.com.
    pub curseforge_api_key: Option<String>,
    /// Game settings written into every instance before it launches.
    pub game_options: GameOptions,
    /// The 1.8 page of Game settings: wins over `game_options` on versions before 1.9.
    pub game_options_legacy: GameOptions,
    /// Novex Client settings written into every instance that has it, before it launches.
    pub client_options: GameOptions,
    /// The 1.8 page of the client settings: wins over `client_options` on versions before 1.9.
    pub client_options_legacy: GameOptions,
    /// Set up new instances from this instance's settings (see game_options).
    pub template: Option<TemplateInfo>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            max_memory_mb: 4096,
            java_path: None,
            jvm_args: String::new(),
            auto_update: true,
            curseforge_api_key: None,
            game_options: GameOptions::default(),
            game_options_legacy: GameOptions::default(),
            client_options: GameOptions::default(),
            client_options_legacy: GameOptions::default(),
            template: None,
        }
    }
}

impl Settings {
    pub fn load(paths: &Paths) -> Self {
        let s: Self = std::fs::read(paths.root.join("settings.json"))
            .ok()
            .and_then(|b| serde_json::from_slice(&b).ok())
            .unwrap_or_default();
        crate::content::curseforge::set_saved_key(s.curseforge_api_key.clone());
        s
    }

    pub(crate) fn save(&self, paths: &Paths) -> Result<()> {
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
    s.curseforge_api_key = s
        .curseforge_api_key
        .map(|k| k.trim().to_string())
        .filter(|k| !k.is_empty());
    crate::content::curseforge::set_saved_key(s.curseforge_api_key.clone());
    s.save(&state.paths)?;
    *state.settings.lock().await = s.clone();
    Ok(s)
}
