//! Novex Client: our own HUD mod, built for each Minecraft version and loader in apps/client and
//! embedded in the launcher. Turning it on copies the matching jar into the instance and installs
//! the mods that go with it from Modrinth: Fabric API (which the Fabric builds need) and Sodium or
//! Embeddium for frame rate where they exist.

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use tauri::State;

use crate::content::{self, ContentKind, Source};
use crate::error::{msg, Result};
use crate::instances::{self, Instance};
use crate::loaders::LoaderKind;
use crate::platform::Paths;
use crate::AppState;

mod jars {
    include!(concat!(env!("OUT_DIR"), "/client_jars.rs"));
}

const FILE: &str = "novex-client.jar";
const FABRIC_API: &str = "P7dR8mSH";
const SODIUM: &str = "AANobbMI";
const EMBEDDIUM: &str = "sk9rgfiA";

/// Quilt loads Fabric mods, so Quilt instances use the Fabric build.
fn loader_key(l: LoaderKind) -> Option<&'static str> {
    match l {
        LoaderKind::Fabric | LoaderKind::Quilt => Some("fabric"),
        LoaderKind::NeoForge => Some("neoforge"),
        LoaderKind::Forge => Some("forge"),
        LoaderKind::Vanilla => None,
    }
}

fn jar_for(inst: &Instance) -> Option<&'static [u8]> {
    let loader = loader_key(inst.loader)?;
    jars::JARS
        .iter()
        .find(|(l, mc, _)| *l == loader && *mc == inst.version)
        .map(|(_, _, bytes)| *bytes)
}

/// Minecraft versions with a build for this loader, newest first.
fn versions_for(loader: &str) -> Vec<&'static str> {
    let mut v: Vec<_> = jars::JARS
        .iter()
        .filter(|(l, _, _)| *l == loader)
        .map(|(_, mc, _)| *mc)
        .collect();
    v.sort_by(|a, b| compare_versions(b, a));
    v
}

fn compare_versions(a: &str, b: &str) -> std::cmp::Ordering {
    let parts = |s: &str| {
        s.split('.')
            .map(|p| p.parse::<u32>().unwrap_or(0))
            .collect::<Vec<_>>()
    };
    parts(a).cmp(&parts(b))
}

/// Mods installed alongside: (Modrinth id, required). Optional ones are skipped when Modrinth
/// has no build for the instance.
fn companions(l: LoaderKind) -> &'static [(&'static str, bool)] {
    match l {
        LoaderKind::Fabric | LoaderKind::Quilt => &[(FABRIC_API, true), (SODIUM, false)],
        LoaderKind::NeoForge => &[(SODIUM, false)],
        LoaderKind::Forge => &[(EMBEDDIUM, false)],
        LoaderKind::Vanilla => &[],
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientStatus {
    pub enabled: bool,
    /// Why the client can't run on this instance, if it can't.
    pub unsupported: Option<String>,
    /// Module switches from config/novex-client.json.
    pub modules: Map<String, Value>,
}

fn unsupported(inst: &Instance) -> Option<String> {
    let Some(loader) = loader_key(inst.loader) else {
        return Some(
            "Novex Client needs a modded instance: Fabric, Quilt, NeoForge or Forge.".into(),
        );
    };
    if jar_for(inst).is_some() {
        return None;
    }
    let versions = versions_for(loader);
    Some(format!(
        "Novex Client for {} supports Minecraft {}.",
        inst.loader.label(),
        versions.join(", ")
    ))
}

fn config_path(state: &AppState, id: &str) -> std::path::PathBuf {
    instances::game_dir(&state.paths, id)
        .join("config")
        .join("novex-client.json")
}

fn read_config(state: &AppState, id: &str) -> Map<String, Value> {
    std::fs::read(config_path(state, id))
        .ok()
        .and_then(|b| serde_json::from_slice::<Value>(&b).ok())
        .and_then(|v| v.as_object().cloned())
        .unwrap_or_default()
}

fn status(state: &AppState, inst: &Instance) -> ClientStatus {
    let mods = instances::game_dir(&state.paths, &inst.id).join("mods");
    ClientStatus {
        enabled: mods.join(FILE).exists(),
        unsupported: unsupported(inst),
        modules: read_config(state, &inst.id),
    }
}

/// Keeps an installed Novex Client current: if it's on for this instance and the launcher carries a
/// different build for the instance's version and loader, the new one replaces it. Returns whether
/// it replaced anything. Called before every launch, so updating the launcher updates the client.
pub fn sync(paths: &Paths, inst: &Instance) -> Result<bool> {
    let path = instances::game_dir(paths, &inst.id).join("mods").join(FILE);
    let Some(jar) = jar_for(inst) else {
        return Ok(false);
    };
    match std::fs::read(&path) {
        Ok(current) if current != jar => {
            std::fs::write(&path, jar)?;
            Ok(true)
        }
        _ => Ok(false),
    }
}

#[tauri::command]
pub async fn client_status(
    state: State<'_, AppState>,
    instance_id: String,
) -> Result<ClientStatus> {
    let inst = instances::load(&state.paths, &instance_id)?;
    sync(&state.paths, &inst)?;
    Ok(status(&state, &inst))
}

#[tauri::command]
pub async fn client_set_enabled(
    state: State<'_, AppState>,
    instance_id: String,
    enabled: bool,
) -> Result<ClientStatus> {
    let inst = instances::load(&state.paths, &instance_id)?;
    let mods = instances::game_dir(&state.paths, &inst.id).join("mods");
    if enabled {
        let jar = jar_for(&inst).ok_or_else(|| msg(unsupported(&inst).unwrap_or_default()))?;
        for &(project, required) in companions(inst.loader) {
            let installed = content::Manifest::load(&state.paths, &inst.id)
                .items
                .iter()
                .any(|t| t.source == Source::Modrinth && t.project_id == project);
            if installed {
                continue;
            }
            let result = content::install(
                &state.http,
                &state.paths,
                &inst,
                Source::Modrinth,
                project,
                ContentKind::Mod,
                None,
            )
            .await;
            // Optional mods (Sodium, Embeddium) don't exist for every version.
            if let Err(e) = result {
                if required {
                    return Err(e);
                }
            }
        }
        std::fs::create_dir_all(&mods)?;
        std::fs::write(mods.join(FILE), jar)?;
    } else if mods.join(FILE).exists() {
        // Companion mods stay: they're ordinary mods the player may want anyway.
        std::fs::remove_file(mods.join(FILE))?;
    }
    Ok(status(&state, &inst))
}

#[derive(Debug, Deserialize)]
pub struct ModuleChange {
    pub key: String,
    pub value: Value,
}

/// Changes module switches. The game reads the file at startup, so changes apply on next launch.
#[tauri::command]
pub async fn client_set_module(
    state: State<'_, AppState>,
    instance_id: String,
    change: ModuleChange,
) -> Result<ClientStatus> {
    let inst = instances::load(&state.paths, &instance_id)?;
    let mut cfg = read_config(&state, &inst.id);
    cfg.insert(change.key, change.value);
    let path = config_path(&state, &inst.id);
    std::fs::create_dir_all(path.parent().unwrap())?;
    std::fs::write(&path, serde_json::to_vec_pretty(&Value::Object(cfg))?)?;
    Ok(status(&state, &inst))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn versions_sort_numerically() {
        let mut v = vec!["1.8.9", "1.21.11", "26.3", "1.21.8", "1.20.1"];
        v.sort_by(|a, b| compare_versions(b, a));
        assert_eq!(v, ["26.3", "1.21.11", "1.21.8", "1.20.1", "1.8.9"]);
    }

    #[test]
    fn every_loader_has_builds() {
        for loader in ["fabric", "neoforge", "forge"] {
            assert!(
                !versions_for(loader).is_empty(),
                "no {loader} jars embedded"
            );
        }
        assert!(versions_for("fabric").contains(&"26.3"));
        assert!(versions_for("forge").contains(&"1.8.9"));
    }
}

#[cfg(test)]
mod sync_tests {
    use super::*;
    use crate::loaders::LoaderKind;

    fn instance(dir: &std::path::Path, version: &str) -> (Paths, Instance) {
        let paths = Paths {
            root: dir.to_path_buf(),
        };
        let mut inst: Instance = serde_json::from_value(serde_json::json!({
            "id": "test", "name": "Test", "version": version, "loader": "fabric", "created": 0, "playTimeSecs": 0
        }))
        .unwrap();
        inst.loader = LoaderKind::Fabric;
        (paths, inst)
    }

    #[test]
    fn replaces_an_outdated_jar_and_leaves_others_alone() {
        let dir = std::env::temp_dir().join(format!("novex-sync-{}", std::process::id()));
        let (paths, inst) = instance(&dir, "26.3");
        let mods = instances::game_dir(&paths, &inst.id).join("mods");
        std::fs::create_dir_all(&mods).unwrap();

        // Not installed: nothing happens.
        assert!(!sync(&paths, &inst).unwrap());
        assert!(!mods.join(FILE).exists());

        // Old build: replaced with the bundled one, then left alone.
        std::fs::write(mods.join(FILE), b"old").unwrap();
        assert!(sync(&paths, &inst).unwrap());
        assert_eq!(
            std::fs::read(mods.join(FILE)).unwrap(),
            jar_for(&inst).unwrap()
        );
        assert!(!sync(&paths, &inst).unwrap());
        std::fs::remove_dir_all(&dir).ok();
    }
}
