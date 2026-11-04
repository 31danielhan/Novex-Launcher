//! Novex Client: our own HUD mod, built for each Minecraft version and loader in apps/client and
//! embedded in the launcher. Turning it on copies the matching jar into the instance and installs
//! the mods that go with it from Modrinth: Fabric API (which the Fabric builds need) and Sodium or
//! Embeddium for frame rate where they exist.

use serde::Serialize;
use serde_json::{Map, Value};
use tauri::State;

use crate::content::{self, ContentKind, Source};
use crate::error::{msg, Result};
use crate::game_options::{self, GameOptions};
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
    /// Installed, but the launcher carries a different build.
    pub outdated: bool,
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

fn jar_path(paths: &Paths, id: &str) -> std::path::PathBuf {
    instances::game_dir(paths, id).join("mods").join(FILE)
}

fn status(state: &AppState, inst: &Instance) -> ClientStatus {
    let jar = jar_path(&state.paths, &inst.id);
    ClientStatus {
        enabled: jar.exists(),
        unsupported: unsupported(inst),
        outdated: matches!(
            (std::fs::read(&jar), jar_for(inst)),
            (Ok(current), Some(bundled)) if current != bundled
        ),
    }
}

/// Writes the Client tab's settings into the instance's config/novex-client.json, leaving
/// everything else there (such as the HUD layout) alone. The 1.8 page wins before 1.9. The game
/// reads the file at startup, so this runs before every launch.
pub fn apply(paths: &Paths, inst: &Instance, shared: &GameOptions, legacy: &GameOptions) -> Result<()> {
    if !jar_path(paths, &inst.id).exists() {
        return Ok(());
    }
    let old = game_options::version(&inst.version) < (1, 9, 0);
    let path = instances::game_dir(paths, &inst.id)
        .join("config")
        .join("novex-client.json");
    let mut cfg: Map<String, Value> = std::fs::read(&path)
        .ok()
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_default();
    let before = cfg.clone();
    let pages = [Some(shared), old.then_some(legacy)];
    for (k, v) in pages.into_iter().flatten().flatten() {
        // "hudSize.fps" sets fps inside the hudSize object.
        match k.split_once('.') {
            Some((group, key)) => {
                let group = cfg.entry(group).or_insert_with(|| Value::Object(Map::new()));
                if !group.is_object() {
                    *group = Value::Object(Map::new());
                }
                group[key] = v.clone();
            }
            None => {
                cfg.insert(k.clone(), v.clone());
            }
        }
    }
    if cfg != before {
        std::fs::create_dir_all(path.parent().unwrap())?;
        std::fs::write(&path, serde_json::to_vec_pretty(&Value::Object(cfg))?)?;
    }
    Ok(())
}

/// A running game holds the jar open, and on Windows it can't be changed.
async fn ensure_stopped(state: &AppState, id: &str) -> Result<()> {
    if state.running.lock().await.contains_key(id) {
        return Err(msg("Close this instance first."));
    }
    Ok(())
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
    Ok(status(&state, &inst))
}

#[tauri::command]
pub async fn client_update(
    state: State<'_, AppState>,
    instance_id: String,
) -> Result<ClientStatus> {
    ensure_stopped(&state, &instance_id).await?;
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
    ensure_stopped(&state, &instance_id).await?;
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

    #[test]
    fn settings_merge_into_the_config_and_keep_the_rest() {
        let dir = std::env::temp_dir().join(format!("novex-apply-{}", std::process::id()));
        let (paths, inst) = instance(&dir, "1.8.9");
        let game = instances::game_dir(&paths, &inst.id);
        let shared = GameOptions::from([
            ("fps".to_string(), Value::Bool(false)),
            ("hudSize.fps".to_string(), Value::from(1.5)),
        ]);
        let legacy = GameOptions::from([("fps".to_string(), Value::Bool(true))]);

        // Not installed: no config appears.
        apply(&paths, &inst, &shared, &legacy).unwrap();
        assert!(!game.join("config").exists());

        std::fs::create_dir_all(game.join("mods")).unwrap();
        std::fs::write(game.join("mods").join(FILE), b"jar").unwrap();
        std::fs::create_dir_all(game.join("config")).unwrap();
        let file = game.join("config").join("novex-client.json");
        std::fs::write(&file, r#"{"hud":{"fps":1},"ping":true}"#).unwrap();

        apply(&paths, &inst, &shared, &legacy).unwrap();
        let cfg: Value = serde_json::from_slice(&std::fs::read(&file).unwrap()).unwrap();
        assert_eq!(cfg["fps"], true, "the 1.8 page wins before 1.9");
        assert_eq!(cfg["ping"], true);
        assert_eq!(cfg["hud"]["fps"], 1);
        assert_eq!(cfg["hudSize"]["fps"], 1.5);

        let (_, newer) = instance(&dir, "26.3");
        apply(&paths, &newer, &shared, &legacy).unwrap();
        let cfg: Value = serde_json::from_slice(&std::fs::read(&file).unwrap()).unwrap();
        assert_eq!(cfg["fps"], false, "the shared page applies from 1.9");
        std::fs::remove_dir_all(&dir).ok();
    }
}
