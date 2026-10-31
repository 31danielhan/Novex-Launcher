//! Instances: a game version, an optional mod loader, per-instance overrides and a private
//! game directory.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::{msg, Result};
use crate::loaders::LoaderKind;
use crate::platform::{now_secs, Paths};
use crate::settings::Settings;
use crate::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Instance {
    pub id: String,
    pub name: String,
    pub version: String,
    #[serde(default)]
    pub loader: LoaderKind,
    #[serde(default)]
    pub loader_version: Option<String>,
    pub created: u64,
    #[serde(default)]
    pub last_played: Option<u64>,
    #[serde(default)]
    pub play_time_secs: u64,
    /// Overrides of the global settings; `None` means "use global".
    #[serde(default)]
    pub memory_mb: Option<u32>,
    #[serde(default)]
    pub java_path: Option<String>,
    #[serde(default)]
    pub jvm_args: Option<String>,
}

impl Instance {
    pub fn effective_settings(&self, global: &Settings) -> Settings {
        Settings {
            max_memory_mb: self.memory_mb.unwrap_or(global.max_memory_mb),
            java_path: self.java_path.clone().or_else(|| global.java_path.clone()),
            jvm_args: self
                .jvm_args
                .clone()
                .unwrap_or_else(|| global.jvm_args.clone()),
        }
    }
}

/// Fields the settings dialog can change.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstancePatch {
    pub name: String,
    pub loader_version: Option<String>,
    pub memory_mb: Option<u32>,
    pub java_path: Option<String>,
    pub jvm_args: Option<String>,
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

fn clean(s: Option<String>) -> Option<String> {
    s.map(|s| s.trim().to_string()).filter(|s| !s.is_empty())
}

fn copy_dir(from: &Path, to: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(to)?;
    for entry in std::fs::read_dir(from)? {
        let entry = entry?;
        let dest = to.join(entry.file_name());
        let ft = entry.file_type()?;
        if ft.is_dir() {
            copy_dir(&entry.path(), &dest)?;
        } else if ft.is_file() {
            std::fs::copy(entry.path(), dest)?;
        }
    }
    Ok(())
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
    loader: LoaderKind,
    loader_version: Option<String>,
) -> Result<Instance> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err(msg("Give the instance a name."));
    }
    if version.is_empty() {
        return Err(msg("Pick a Minecraft version."));
    }
    let loader_version = clean(loader_version);
    if loader != LoaderKind::Vanilla && loader_version.is_none() {
        return Err(msg(format!("Pick a {} version.", loader.label())));
    }
    let inst = Instance {
        id: unique_id(&state.paths, &name),
        name,
        version,
        loader,
        loader_version,
        created: now_secs(),
        last_played: None,
        play_time_secs: 0,
        memory_mb: None,
        java_path: None,
        jvm_args: None,
    };
    save(&state.paths, &inst)?;
    std::fs::create_dir_all(game_dir(&state.paths, &inst.id))?;
    if loader != LoaderKind::Vanilla {
        std::fs::create_dir_all(game_dir(&state.paths, &inst.id).join("mods"))?;
    }
    Ok(inst)
}

#[tauri::command]
pub fn instance_update(
    state: State<'_, AppState>,
    id: String,
    patch: InstancePatch,
) -> Result<Instance> {
    let mut inst = load(&state.paths, &id)?;
    let name = patch.name.trim();
    if name.is_empty() {
        return Err(msg("Give the instance a name."));
    }
    inst.name = name.to_string();
    if inst.loader != LoaderKind::Vanilla {
        inst.loader_version = clean(patch.loader_version).or(inst.loader_version);
    }
    inst.memory_mb = patch.memory_mb.map(|m| m.clamp(512, 65536));
    inst.java_path = clean(patch.java_path);
    inst.jvm_args = clean(patch.jvm_args);
    save(&state.paths, &inst)?;
    Ok(inst)
}

#[tauri::command]
pub async fn instance_clone(state: State<'_, AppState>, id: String) -> Result<Instance> {
    let src = load(&state.paths, &id)?;
    let name = format!("{} (copy)", src.name);
    let new_id = unique_id(&state.paths, &name);
    let (from, to) = (dir(&state.paths, &id), dir(&state.paths, &new_id));
    tokio::task::spawn_blocking(move || copy_dir(&from, &to))
        .await
        .map_err(|e| msg(e.to_string()))??;
    let inst = Instance {
        id: new_id,
        name,
        created: now_secs(),
        last_played: None,
        play_time_secs: 0,
        ..src
    };
    save(&state.paths, &inst)?;
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
