//! Instances: a name, a game version and a private game directory.
//! Loaders, per-instance settings, cloning and importing arrive in M3.

use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::{msg, Result};
use crate::platform::{now_secs, Paths};
use crate::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Instance {
    pub id: String,
    pub name: String,
    pub version: String,
    pub created: u64,
    #[serde(default)]
    pub last_played: Option<u64>,
    #[serde(default)]
    pub play_time_secs: u64,
}

pub fn dir(paths: &Paths, id: &str) -> PathBuf {
    paths.instances().join(id)
}

pub fn game_dir(paths: &Paths, id: &str) -> PathBuf {
    dir(paths, id).join("minecraft")
}

fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

pub fn load(paths: &Paths, id: &str) -> Result<Instance> {
    if !valid_id(id) {
        return Err(msg("Invalid instance id."));
    }
    let bytes = std::fs::read(dir(paths, id).join("instance.json"))
        .map_err(|_| msg("Instance not found."))?;
    Ok(serde_json::from_slice(&bytes)?)
}

pub fn save(paths: &Paths, inst: &Instance) -> Result<()> {
    let d = dir(paths, &inst.id);
    std::fs::create_dir_all(&d)?;
    std::fs::write(d.join("instance.json"), serde_json::to_vec_pretty(inst)?)?;
    Ok(())
}

/// Readable folder names: "My World" → "my-world", "my-world-2", …
fn unique_id(paths: &Paths, name: &str) -> String {
    let mut base: String = name
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect();
    base = base
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    if base.is_empty() {
        base = "instance".into();
    }
    let mut id = base.clone();
    let mut n = 2;
    while dir(paths, &id).exists() {
        id = format!("{base}-{n}");
        n += 1;
    }
    id
}

#[tauri::command]
pub fn instances_list(state: State<'_, AppState>) -> Result<Vec<Instance>> {
    let root = state.paths.instances();
    let mut list = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&root) {
        for e in entries.flatten() {
            if let Some(id) = e.file_name().to_str() {
                if let Ok(inst) = load(&state.paths, id) {
                    list.push(inst);
                }
            }
        }
    }
    list.sort_by(|a, b| {
        b.last_played
            .unwrap_or(0)
            .cmp(&a.last_played.unwrap_or(0))
            .then(b.created.cmp(&a.created))
    });
    Ok(list)
}

#[tauri::command]
pub fn instance_create(
    state: State<'_, AppState>,
    name: String,
    version: String,
) -> Result<Instance> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err(msg("Give the instance a name."));
    }
    if version.is_empty() {
        return Err(msg("Pick a Minecraft version."));
    }
    let inst = Instance {
        id: unique_id(&state.paths, &name),
        name,
        version,
        created: now_secs(),
        last_played: None,
        play_time_secs: 0,
    };
    save(&state.paths, &inst)?;
    std::fs::create_dir_all(game_dir(&state.paths, &inst.id))?;
    Ok(inst)
}

#[tauri::command]
pub async fn instance_delete(state: State<'_, AppState>, id: String) -> Result<()> {
    if state.running.lock().await.contains_key(&id) {
        return Err(msg("Stop the game before deleting this instance."));
    }
    load(&state.paths, &id)?;
    std::fs::remove_dir_all(dir(&state.paths, &id))?;
    Ok(())
}

#[tauri::command]
pub fn instance_folder(state: State<'_, AppState>, id: String) -> Result<String> {
    load(&state.paths, &id)?;
    let d = game_dir(&state.paths, &id);
    std::fs::create_dir_all(&d)?;
    Ok(d.to_string_lossy().into_owned())
}
