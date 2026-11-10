//! Novex Client: our own HUD mod, built for each Minecraft version and loader in apps/client and
//! embedded in the launcher. Turning it on copies the matching jar into the instance and installs
//! the mods that go with it from Modrinth: Fabric API (which the Fabric builds need) and a set of
//! frame-rate mods where they exist for the version. The set follows the performance bundle in
//! Polyfrost's OneClient (github.com/Polyfrost/OneLauncher, GPL-3.0). Libraries they need, such as
//! Kotlin or a config library, come with them as dependencies.

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
/// Nuit: draws custom skies from resource packs.
const NUIT: &str = "YBz7DOs8";
// Frame-rate mods from OneClient's performance bundle.
const LITHIUM: &str = "gvQqBUqZ";
const FERRITECORE: &str = "uXXizFIs";
const IMMEDIATELYFAST: &str = "5ZwdcRci";
const ENTITYCULLING: &str = "NNAgCjsB";
const MODERNFIX: &str = "TjSm1wrD";
const SCALABLELUX: &str = "Ps1zyz6x";
const PARTICLE_CORE: &str = "RSeLon5O";
const FASTQUIT: &str = "x1hIzbuY";
/// C2ME and VMP ship as alpha and beta builds; the newest of those is used when there's no release.
const C2ME: &str = "VSNURh3q";
const VMP: &str = "wnEe9KBa";
const IXERIS: &str = "p8RJPJIC";
const GNETUM: &str = "7MoE34WK";
// OneClient's 1.8.9 performance bundle, for Ornithe.
const PYLON: &str = "wx17t6U9";
const SLIPSTREAM: &str = "XDGYMuZ6";
const EXPLOINT: &str = "mL0gJygK";
const ASYNC_LOGGER: &str = "zvNzKfGF";
const LEGACY_DYNAMIC_FPS: &str = "rCItxJku";
const WINDOWS_PRIORITY_BOOST: &str = "7ZoK90Xo";

/// A companion published only as GitHub releases.
struct GithubCompanion {
    repo: &'static str,
    /// The release to install: the one OneClient's bundle ships, so the set matches what it tests.
    tag: &'static str,
    /// File name starts, one jar each. A repository's files depend on each other (Argentum Extras
    /// and Cera need Argentum), so they're installed together or not at all.
    prefixes: &'static [&'static str],
}

fn github_companions(l: LoaderKind) -> &'static [GithubCompanion] {
    match l {
        // Polyfrost's rendering improvements and resource pack extensions, and their memory fixes.
        LoaderKind::Ornithe => &[
            GithubCompanion {
                repo: "Polyfrost/Argentum",
                tag: "v1.0.3-beta.1",
                prefixes: &["argentum-", "argentum-extras-", "cera-"],
            },
            GithubCompanion {
                repo: "Polyfrost/Sarcio",
                tag: "v1.2.0-beta.1",
                prefixes: &["Sarcio-"],
            },
            GithubCompanion {
                repo: "saadndm/soundfix",
                tag: "v1.2.0",
                prefixes: &["soundfix-"],
            },
        ],
        _ => &[],
    }
}

/// The jar name start that owns `name`. Starts can overlap ("argentum-" and "argentum-extras-"),
/// so a file belongs to the longest one it matches.
fn owner<'a>(prefixes: &[&'a str], name: &str) -> Option<&'a str> {
    prefixes
        .iter()
        .filter(|p| name.starts_with(*p))
        .max_by_key(|p| p.len())
        .copied()
}

/// What the launcher installed alongside the client before the performance set, so instances
/// that already had it don't get removed ones back.
const OLD_COMPANIONS: &[&str] = &[FABRIC_API, SODIUM, EMBEDDIUM, NUIT];

/// Quilt loads Fabric mods, so Quilt instances use the Fabric build.
fn loader_key(l: LoaderKind) -> Option<&'static str> {
    match l {
        LoaderKind::Fabric | LoaderKind::Quilt => Some("fabric"),
        LoaderKind::Ornithe => Some("ornithe"),
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
        LoaderKind::Fabric | LoaderKind::Quilt => &[
            (FABRIC_API, true),
            (SODIUM, false),
            (LITHIUM, false),
            (FERRITECORE, false),
            (IMMEDIATELYFAST, false),
            (ENTITYCULLING, false),
            (MODERNFIX, false),
            (SCALABLELUX, false),
            (PARTICLE_CORE, false),
            (FASTQUIT, false),
            (C2ME, false),
            (VMP, false),
            (IXERIS, false),
            (GNETUM, false),
            (NUIT, false),
        ],
        LoaderKind::NeoForge => &[
            (SODIUM, false),
            (LITHIUM, false),
            (FERRITECORE, false),
            (IMMEDIATELYFAST, false),
            (ENTITYCULLING, false),
            (MODERNFIX, false),
            (SCALABLELUX, false),
            (PARTICLE_CORE, false),
            (FASTQUIT, false),
            (C2ME, false),
            (VMP, false),
            (IXERIS, false),
            (GNETUM, false),
            (NUIT, false),
        ],
        // Pylon swaps in LWJGL 3; the rest smooth frame pacing and fix old bugs.
        LoaderKind::Ornithe => &[
            (PYLON, true),
            (SLIPSTREAM, false),
            (EXPLOINT, false),
            (ASYNC_LOGGER, false),
            (LEGACY_DYNAMIC_FPS, false),
            (WINDOWS_PRIORITY_BOOST, false),
        ],
        LoaderKind::Forge => &[
            (EMBEDDIUM, false),
            (FERRITECORE, false),
            (IMMEDIATELYFAST, false),
            (ENTITYCULLING, false),
            (PARTICLE_CORE, false),
            (C2ME, false),
            (IXERIS, false),
            (GNETUM, false),
        ],
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
            "Novex Client needs a modded instance: Fabric, Quilt, Ornithe, NeoForge or Forge."
                .into(),
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

pub fn enabled(paths: &Paths, id: &str) -> bool {
    jar_path(paths, id).exists()
}

/// Whether a launch should check this instance's companion mods: when the player chose the
/// performance mods, when Novex Client is on (it needs Fabric API), and always on Ornithe (Pylon).
pub fn wants_companions(paths: &Paths, inst: &Instance) -> bool {
    inst.performance_mods == Some(true)
        || enabled(paths, &inst.id)
        || inst.loader == LoaderKind::Ornithe
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
pub fn apply(
    paths: &Paths,
    inst: &Instance,
    shared: &GameOptions,
    legacy: &GameOptions,
) -> Result<()> {
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
                let group = cfg
                    .entry(group)
                    .or_insert_with(|| Value::Object(Map::new()));
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

/// Companion mods already offered to an instance. Each is installed once: one the player removes
/// stays removed, and one added in a launcher update arrives on the next launch.
fn offered_path(paths: &Paths, id: &str) -> std::path::PathBuf {
    instances::dir(paths, id).join("novex-companions.json")
}

fn load_offered(paths: &Paths, id: &str) -> Vec<String> {
    match std::fs::read(offered_path(paths, id)) {
        Ok(b) => serde_json::from_slice(&b).unwrap_or_default(),
        // No record: the client was turned on before the record existed, with the old set.
        Err(_) if jar_path(paths, id).exists() => {
            OLD_COMPANIONS.iter().map(|s| s.to_string()).collect()
        }
        Err(_) => Vec::new(),
    }
}

/// Installs the companions this instance hasn't been offered yet. A mod with no build for the
/// instance counts as offered; one that fails to download (offline) is tried again next time.
/// With `strict`, a required companion failing is an error; otherwise failures are skipped so a
/// launch never stops over them.
pub async fn install_companions(
    http: &reqwest::Client,
    paths: &Paths,
    inst: &Instance,
    strict: bool,
) -> Result<()> {
    let mut offered = load_offered(paths, &inst.id);
    let target = content::Target::of(inst);
    // With the performance mods turned off, only what's needed: Fabric API, and Pylon on Ornithe.
    // The rest stay unrecorded, so turning them on later still installs them.
    let full = inst.performance_mods != Some(false);
    for &(project, required) in companions(inst.loader) {
        if offered.iter().any(|p| p == project) || !(full || required) {
            continue;
        }
        let installed = content::Manifest::load(paths, &inst.id)
            .items
            .iter()
            .any(|t| t.source == Source::Modrinth && t.project_id == project);
        let done = if installed {
            true
        } else {
            match content::versions(
                http,
                Source::Modrinth,
                project,
                ContentKind::Mod,
                Some(&target),
            )
            .await
            {
                Ok(list) if list.is_empty() => true,
                Ok(_) => {
                    let result = content::install(
                        http,
                        paths,
                        inst,
                        Source::Modrinth,
                        project,
                        ContentKind::Mod,
                        None,
                    )
                    .await;
                    match result {
                        Ok(_) => true,
                        Err(e) if strict && required => return Err(e),
                        Err(_) => false,
                    }
                }
                Err(e) if strict && required => return Err(e),
                Err(_) => false,
            }
        };
        if done {
            offered.push(project.to_string());
        }
    }
    let mods = instances::game_dir(paths, &inst.id).join("mods");
    let github: &[GithubCompanion] = if full {
        github_companions(inst.loader)
    } else {
        &[]
    };
    for c in github {
        let key = format!("github:{}@{}", c.repo, c.tag);
        if offered.contains(&key) {
            continue;
        }
        // Records of this repository's earlier releases ("github:repo" before tags were kept).
        let bare = format!("github:{}", c.repo);
        let older = |k: &String| *k == bare || k.starts_with(&format!("{bare}@"));
        let had_older = offered.iter().any(older);
        let old_files = jars_of(&mods, c.prefixes);
        // Installed once and since removed by the player: leave it out, just note the new release.
        if had_older && old_files.is_empty() {
            offered.retain(|k| !older(k));
            offered.push(key);
            continue;
        }
        // All optional: a failed download is tried again on the next launch.
        match github_release_files(http, &mods, c).await {
            Ok(new) => {
                // The new jars replace the older release's, which would load twice otherwise.
                for old in old_files.iter().filter(|f| !new.contains(f)) {
                    let _ = std::fs::remove_file(mods.join(old));
                }
                offered.retain(|k| !older(k));
                offered.push(key);
            }
            Err(e) => eprintln!("[client] couldn't download from {}: {e}", c.repo),
        }
    }
    if cfg!(target_os = "macos") && !offered.iter().any(|k| k == HIGH_DPI) && high_dpi_screen(&mods)? {
        offered.push(HIGH_DPI.to_string());
    }
    std::fs::create_dir_all(instances::dir(paths, &inst.id))?;
    std::fs::write(offered_path(paths, &inst.id), serde_json::to_vec(&offered)?)?;
    Ok(())
}

/// Recorded once the launcher has turned on High-DPI Screen, so a player's later choice stands.
const HIGH_DPI: &str = "setting:high-dpi-screen";

/// Turns on Argentum Extras' High-DPI Screen, so 1.8.9 renders at the Retina display's full
/// resolution and the menus and text come out sharp. Novex Client keeps the GUI its usual size
/// there. Returns false when Argentum Extras isn't installed (yet), to try again next launch. The
/// rest of the file is left alone; Argentum fills in what's missing.
fn high_dpi_screen(mods: &std::path::Path) -> Result<bool> {
    if jars_of(mods, &["argentum-extras-"]).is_empty() {
        return Ok(false);
    }
    let Some(game) = mods.parent() else {
        return Ok(false);
    };
    let path = game.join("config").join("argentum-extras.json");
    let mut config = match std::fs::read(&path) {
        Ok(bytes) => match serde_json::from_slice::<serde_json::Value>(&bytes) {
            Ok(v) if v.is_object() => v,
            // A file Argentum can't read either; leave it to Argentum.
            _ => return Ok(false),
        },
        Err(_) => serde_json::json!({}),
    };
    config["high_dpi_screen"] = serde_json::Value::Bool(true);
    std::fs::create_dir_all(game.join("config"))?;
    std::fs::write(&path, serde_json::to_vec_pretty(&config)?)?;
    Ok(true)
}

#[derive(serde::Deserialize)]
struct Release {
    assets: Vec<Asset>,
}

#[derive(serde::Deserialize)]
struct Asset {
    name: String,
    browser_download_url: String,
}

/// The jars in `mods` that belong to one of `prefixes`.
fn jars_of(mods: &std::path::Path, prefixes: &[&str]) -> Vec<String> {
    let Ok(dir) = std::fs::read_dir(mods) else {
        return vec![];
    };
    dir.filter_map(|e| e.ok()?.file_name().into_string().ok())
        .filter(|n| n.ends_with(".jar") && owner(prefixes, n).is_some())
        .collect()
}

/// Downloads the companion's release jar for each name start, and writes them into the mods folder
/// only once all have downloaded. Returns the file names written.
async fn github_release_files(
    http: &reqwest::Client,
    mods: &std::path::Path,
    c: &GithubCompanion,
) -> Result<Vec<String>> {
    let url = format!(
        "https://api.github.com/repos/{}/releases/tags/{}",
        c.repo, c.tag
    );
    let release: Release = crate::downloads::get_json(http, &url).await?;
    let mut files = Vec::new();
    for &prefix in c.prefixes {
        let asset = release
            .assets
            .iter()
            .find(|a| {
                a.name.ends_with(".jar")
                    && !a.name.ends_with("-sources.jar")
                    && !a.name.ends_with("-dev.jar")
                    && owner(c.prefixes, &a.name) == Some(prefix)
            })
            .ok_or_else(|| msg(format!("{} {} has no {prefix} jar.", c.repo, c.tag)))?;
        let name = content::safe_file_name(&asset.name)?.to_string();
        files.push((name, download(http, &asset.browser_download_url).await?));
    }
    std::fs::create_dir_all(mods)?;
    let mut names = Vec::new();
    for (name, bytes) in files {
        std::fs::write(mods.join(&name), bytes)?;
        names.push(name);
    }
    Ok(names)
}

/// GitHub's download host sometimes answers 5xx; a couple of retries usually get through.
async fn download(http: &reqwest::Client, url: &str) -> Result<Vec<u8>> {
    let mut last = None;
    for _ in 0..3 {
        let result = async {
            http.get(url)
                .send()
                .await?
                .error_for_status()?
                .bytes()
                .await
        }
        .await;
        match result {
            Ok(bytes) => return Ok(bytes.to_vec()),
            Err(e) => last = Some(e),
        }
    }
    Err(last.expect("at least one attempt").into())
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

/// Installs the client and its companion mods into an instance.
pub async fn enable(http: &reqwest::Client, paths: &Paths, inst: &Instance) -> Result<()> {
    let jar = jar_for(inst).ok_or_else(|| msg(unsupported(inst).unwrap_or_default()))?;
    install_companions(http, paths, inst, true).await?;
    let mods = instances::game_dir(paths, &inst.id).join("mods");
    std::fs::create_dir_all(&mods)?;
    std::fs::write(mods.join(FILE), jar)?;
    Ok(())
}

/// Whether an instance can move to Ornithe: old Forge (1.12.2 and older), or Fabric on the versions
/// only Legacy Fabric covers (1.13.2 and older). Ornithe is Fabric Loader for those versions, with
/// the OneClient performance mods, and much faster.
fn can_switch_to_ornithe(inst: &Instance) -> bool {
    let v = game_options::version(&inst.version);
    match inst.loader {
        LoaderKind::Forge => v < (1, 13, 0),
        LoaderKind::Fabric => v < (1, 14, 0),
        _ => false,
    }
}

/// A folder name next to `base` that isn't taken yet: mods-forge, mods-forge-2, …
fn free_dir(base: &std::path::Path) -> std::path::PathBuf {
    let mut dir = base.to_path_buf();
    let mut n = 2;
    while dir.exists() {
        dir = base.with_file_name(format!(
            "{}-{n}",
            base.file_name().unwrap_or_default().to_string_lossy()
        ));
        n += 1;
    }
    dir
}

/// Moves an old Forge or Legacy Fabric instance to Ornithe, which runs it natively on Java 25 and
/// much faster. Their mods can't load on Ornithe, so the mods folder is kept aside as mods-forge or
/// mods-fabric (nothing is deleted). Worlds, options, resource packs and Novex Client's settings stay. Novex Client is
/// reinstalled as the Ornithe build if it was on; the performance mods come on the next launch.
#[tauri::command]
pub async fn instance_switch_to_ornithe(
    state: State<'_, AppState>,
    instance_id: String,
) -> Result<Instance> {
    ensure_stopped(&state, &instance_id).await?;
    switch_to_ornithe(&state.http, &state.paths, &instance_id).await
}

/// The work behind `instance_switch_to_ornithe`, for an instance that isn't running.
pub async fn switch_to_ornithe(
    http: &reqwest::Client,
    paths: &Paths,
    instance_id: &str,
) -> Result<Instance> {
    let mut inst = instances::load(paths, instance_id)?;
    if !can_switch_to_ornithe(&inst) {
        return Err(msg(
            "Only Forge instances on Minecraft 1.12.2 and older, or Fabric ones on 1.13.2 and older, can switch to Ornithe.",
        ));
    }
    let loader_version = crate::loaders::versions(http, LoaderKind::Ornithe, &inst.version)
        .await?
        .into_iter()
        .next()
        .ok_or_else(|| {
            msg(format!(
                "Ornithe doesn't support Minecraft {}.",
                inst.version
            ))
        })?
        .id;
    let had_client = enabled(paths, &inst.id);

    let game = instances::game_dir(paths, &inst.id);
    let mods = game.join("mods");
    if mods.exists() {
        let aside = match inst.loader {
            LoaderKind::Fabric => "mods-fabric",
            _ => "mods-forge",
        };
        std::fs::rename(&mods, free_dir(&game.join(aside)))?;
    }
    // The moved mods are no longer installed here.
    let mut manifest = content::Manifest::load(paths, &inst.id);
    manifest.items.retain(|t| t.kind != ContentKind::Mod);
    manifest.save(paths, &inst.id)?;
    // The old Intel natives and the record of the old loader's companions don't apply any more.
    let dir = instances::dir(paths, &inst.id);
    let _ = std::fs::remove_dir_all(dir.join("natives"));
    // An empty record (not a missing one, which counts as the old Fabric/Forge set) starts fresh.
    std::fs::write(offered_path(paths, &inst.id), b"[]")?;

    inst.loader = LoaderKind::Ornithe;
    inst.loader_version = Some(loader_version);
    instances::save(paths, &inst)?;

    if had_client {
        if let Some(jar) = jar_for(&inst) {
            std::fs::create_dir_all(&mods)?;
            std::fs::write(mods.join(FILE), jar)?;
        }
    }
    // Pylon and the rest now; anything that fails to download comes on the next launch.
    let _ = install_companions(http, paths, &inst, false).await;
    Ok(inst)
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

/// Why Novex Client can't run on a version and loader, or nothing if it can. For the new-instance
/// dialog, before the instance exists.
#[tauri::command]
pub fn client_unsupported(version: String, loader: LoaderKind) -> Option<String> {
    let inst: Instance = serde_json::from_value(serde_json::json!({
        "id": "new", "name": "", "version": version, "loader": loader, "created": 0
    }))
    .ok()?;
    unsupported(&inst)
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
        enable(&state.http, &state.paths, &inst).await?;
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
    fn only_old_forge_and_fabric_switch_to_ornithe() {
        let inst = |loader: &str, version: &str| -> Instance {
            serde_json::from_value(serde_json::json!({
                "id": "t", "name": "T", "version": version, "loader": loader, "created": 0, "playTimeSecs": 0
            }))
            .unwrap()
        };
        assert!(can_switch_to_ornithe(&inst("forge", "1.8.9")));
        assert!(can_switch_to_ornithe(&inst("forge", "1.12.2")));
        assert!(!can_switch_to_ornithe(&inst("forge", "1.20.1")));
        assert!(can_switch_to_ornithe(&inst("fabric", "1.8.9")));
        assert!(can_switch_to_ornithe(&inst("fabric", "1.13.2")));
        assert!(!can_switch_to_ornithe(&inst("fabric", "1.14.4")));
        assert!(!can_switch_to_ornithe(&inst("quilt", "1.8.9")));
        assert!(!can_switch_to_ornithe(&inst("ornithe", "1.8.9")));
    }

    #[test]
    fn new_instances_know_if_the_client_runs() {
        assert_eq!(
            client_unsupported("1.8.9".into(), LoaderKind::Ornithe),
            None
        );
        assert_eq!(
            client_unsupported("1.21.11".into(), LoaderKind::Fabric),
            None
        );
        assert!(client_unsupported("1.21.11".into(), LoaderKind::Vanilla).is_some());
        assert!(client_unsupported("1.16.5".into(), LoaderKind::Fabric).is_some());
    }

    #[test]
    fn high_dpi_screen_turns_on_once_argentum_extras_is_there() {
        let game = std::env::temp_dir().join(format!("novex-high-dpi-{}", std::process::id()));
        let mods = game.join("mods");
        std::fs::create_dir_all(&mods).unwrap();
        assert!(!high_dpi_screen(&mods).unwrap());
        std::fs::write(mods.join("argentum-extras-1.0.3-beta.1.jar"), b"").unwrap();
        std::fs::create_dir_all(game.join("config")).unwrap();
        let cfg = game.join("config").join("argentum-extras.json");
        std::fs::write(&cfg, br#"{"fxaa": true, "high_dpi_screen": false}"#).unwrap();
        assert!(high_dpi_screen(&mods).unwrap());
        let v: serde_json::Value = serde_json::from_slice(&std::fs::read(&cfg).unwrap()).unwrap();
        assert_eq!(v["high_dpi_screen"], true);
        assert_eq!(v["fxaa"], true);
        std::fs::remove_dir_all(&game).unwrap();
    }

    #[test]
    fn free_dir_skips_taken_names() {
        let tmp = std::env::temp_dir().join(format!("novex-free-dir-{}", std::process::id()));
        let base = tmp.join("mods-forge");
        assert_eq!(free_dir(&base), base);
        std::fs::create_dir_all(&base).unwrap();
        assert_eq!(free_dir(&base), tmp.join("mods-forge-2"));
        std::fs::remove_dir_all(&tmp).unwrap();
    }

    #[test]
    fn github_jars_belong_to_the_longest_start() {
        let prefixes = &["argentum-", "argentum-extras-", "cera-"];
        assert_eq!(
            owner(prefixes, "argentum-1.0.0+b45107a.jar"),
            Some("argentum-")
        );
        assert_eq!(
            owner(prefixes, "argentum-extras-1.0.3-beta.1.jar"),
            Some("argentum-extras-")
        );
        assert_eq!(owner(prefixes, "Sarcio-1.0.2.jar"), None);

        let mods = std::env::temp_dir().join(format!("novex-jars-of-{}", std::process::id()));
        std::fs::create_dir_all(&mods).unwrap();
        for f in [
            "argentum-1.0.0.jar",
            "cera-1.0.0.jar",
            "pylon-0.2.7.jar",
            "cera-notes.txt",
        ] {
            std::fs::write(mods.join(f), b"").unwrap();
        }
        let mut found = jars_of(&mods, prefixes);
        found.sort();
        assert_eq!(found, ["argentum-1.0.0.jar", "cera-1.0.0.jar"]);
        std::fs::remove_dir_all(&mods).unwrap();
    }

    #[test]
    fn every_loader_has_builds() {
        for loader in ["fabric", "ornithe", "neoforge", "forge"] {
            assert!(
                !versions_for(loader).is_empty(),
                "no {loader} jars embedded"
            );
        }
        assert!(versions_for("fabric").contains(&"26.3"));
        assert!(versions_for("forge").contains(&"1.8.9"));
        assert!(versions_for("ornithe").contains(&"1.8.9"));
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
