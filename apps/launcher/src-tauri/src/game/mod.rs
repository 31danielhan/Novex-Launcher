//! Preparing and launching a game version.

pub mod files;
pub mod logs;
pub mod skin;
pub mod stats;
pub mod version;

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Instant;

use reqwest::Client;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::io::{AsyncBufReadExt, AsyncRead, BufReader};
use tokio::sync::oneshot;

use crate::auth::{self, Credentials};
use crate::downloads::{self, Download};
use crate::error::{msg, Result};
use crate::instances;
use crate::java;
use crate::loaders::{self, LoaderKind};
use crate::platform::{classpath_separator, now_secs, Paths};
use crate::settings::Settings;
use crate::AppState;
use version::VersionJson;

pub struct LaunchPlan {
    pub java: PathBuf,
    pub args: Vec<String>,
}

/// What to launch and where.
pub struct LaunchTarget<'a> {
    pub version: &'a str,
    pub loader: LoaderKind,
    pub loader_version: Option<&'a str>,
    pub game_dir: &'a Path,
    pub natives_dir: &'a Path,
}

/// Everything needed to start the game without touching Tauri, so it can be driven
/// from tests and tools too. `progress(stage, done, total)` reports each step.
pub async fn prepare<P>(
    http: &Client,
    paths: &Paths,
    settings: &Settings,
    target: &LaunchTarget<'_>,
    creds: &Credentials,
    progress: P,
) -> Result<LaunchPlan>
where
    P: Fn(&str, usize, usize) + Send + Sync,
{
    let (game_dir, natives_dir) = (target.game_dir, target.natives_dir);
    progress("Preparing version", 0, 0);
    let vanilla = version::version_json(http, paths, target.version).await?;

    let java = match &settings.java_path {
        Some(p) => {
            let p = PathBuf::from(p);
            if !p.exists() {
                return Err(msg(format!("Java not found at {}", p.display())));
            }
            p
        }
        None => {
            let force_x64 = cfg!(all(target_os = "macos", target_arch = "aarch64"))
                && !vanilla.has_arm64_mac_natives();
            java::ensure_runtime(http, paths, vanilla.java_component(), force_x64, |d, t| {
                progress("Downloading Java", d, t)
            })
            .await?
        }
    };

    // The vanilla jar comes first: Forge's installer patches it.
    let (vanilla_jar, _) = files::client_jar(paths, &vanilla);
    downloads::fetch_all(http, vec![vanilla_jar.clone()], |d, t| {
        progress("Downloading Minecraft", d, t)
    })
    .await?;
    let v = loaders::resolve(
        http,
        paths,
        vanilla,
        target.loader,
        target.loader_version,
        &java,
        &progress,
    )
    .await?;

    tokio::fs::create_dir_all(game_dir).await?;
    let libs = files::libraries(paths, &v);
    let (_, client_jar_path) = files::client_jar(paths, &v);
    let mut dls = libs.downloads.clone();
    let log_config = v.logging.as_ref().and_then(|l| l.client.as_ref()).map(|c| {
        let path = paths.assets().join("log_configs").join(&c.file.id);
        dls.push(Download {
            url: c.file.url.clone(),
            path: path.clone(),
            sha1: Some(c.file.sha1.clone()),
            size: Some(c.file.size),
        });
        c.argument.replace("${path}", &path.to_string_lossy())
    });
    downloads::fetch_all(http, dls, |d, t| progress("Downloading libraries", d, t)).await?;
    files::link_client_jar(&vanilla_jar.path, &client_jar_path)?;

    let game_assets = files::assets(http, paths, &v, game_dir, |d, t| {
        progress("Downloading assets", d, t)
    })
    .await?;

    let jars = libs.native_jars.clone();
    let nd = natives_dir.to_path_buf();
    tokio::task::spawn_blocking(move || files::extract_natives(&jars, &nd))
        .await
        .map_err(|e| msg(e.to_string()))??;

    let mut classpath: Vec<String> = Vec::new();
    for p in libs.classpath.iter().chain([&client_jar_path]) {
        let s = p.to_string_lossy().into_owned();
        if !classpath.contains(&s) {
            classpath.push(s);
        }
    }

    let s = |p: &Path| p.to_string_lossy().into_owned();
    let vars: HashMap<&str, String> = HashMap::from([
        ("auth_player_name", creds.name.clone()),
        ("auth_uuid", creds.uuid.clone()),
        ("auth_access_token", creds.access_token.clone()),
        (
            "auth_session",
            format!("token:{}:{}", creds.access_token, creds.uuid),
        ),
        ("auth_xuid", "0".into()),
        ("clientid", String::new()),
        ("user_type", creds.user_type.into()),
        ("user_properties", "{}".into()),
        ("version_name", v.id.clone()),
        ("version_type", v.kind.clone()),
        ("game_directory", s(game_dir)),
        ("assets_root", s(&paths.assets())),
        ("game_assets", s(&game_assets)),
        ("assets_index_name", v.asset_index.id.clone()),
        ("natives_directory", s(natives_dir)),
        ("library_directory", s(&paths.libraries())),
        ("classpath", classpath.join(classpath_separator())),
        ("classpath_separator", classpath_separator().into()),
        ("launcher_name", "novex-launcher".into()),
        ("launcher_version", env!("CARGO_PKG_VERSION").into()),
    ]);

    Ok(LaunchPlan {
        java,
        args: build_args(
            &v,
            settings,
            target.loader == LoaderKind::Forge,
            log_config,
            &vars,
        ),
    })
}

fn substitute(arg: &str, vars: &HashMap<&str, String>) -> String {
    let mut out = arg.to_string();
    for (k, v) in vars {
        out = out.replace(&format!("${{{k}}}"), v);
    }
    out
}

fn build_args(
    v: &VersionJson,
    settings: &Settings,
    old_forge: bool,
    log_config: Option<String>,
    vars: &HashMap<&str, String>,
) -> Vec<String> {
    let mut jvm = vec![
        format!("-Xmx{}M", settings.max_memory_mb),
        // The garbage collector settings the official launcher uses, for fewer stutters.
        "-XX:+UnlockExperimentalVMOptions".into(),
        "-XX:+UseG1GC".into(),
        "-XX:G1NewSizePercent=20".into(),
        "-XX:G1ReservePercent=20".into(),
        "-XX:MaxGCPauseMillis=50".into(),
        "-XX:G1HeapRegionSize=32M".into(),
        format!("-Xms{}M", settings.max_memory_mb.min(512)),
        "-Dlog4j2.formatMsgNoLookups=true".to_string(),
    ];
    jvm.extend(log_config);
    jvm.extend(settings.jvm_args.split_whitespace().map(str::to_string));

    match &v.arguments {
        Some(a) if !a.jvm.is_empty() => jvm.extend(a.jvm.iter().flat_map(|x| x.values())),
        // Versions before 1.13 list no JVM arguments.
        _ => {
            // On macOS, old Forge must not get -XstartOnFirstThread: with its launchwrapper the
            // GL context ends up on the wrong thread ("glCheckFramebufferStatus returned
            // unknown status:0"). It runs on the patched LWJGL 2 instead (see loaders::forge).
            if cfg!(target_os = "macos") && !old_forge {
                jvm.push("-XstartOnFirstThread".into());
            }
            jvm.push("-Djava.library.path=${natives_directory}".into());
            jvm.push("-cp".into());
            jvm.push("${classpath}".into());
        }
    }

    let game: Vec<String> = match (&v.arguments, &v.minecraft_arguments) {
        (Some(a), _) if !a.game.is_empty() => a.game.iter().flat_map(|x| x.values()).collect(),
        (_, Some(s)) => s.split_whitespace().map(str::to_string).collect(),
        _ => vec![],
    };

    jvm.iter()
        .map(|a| substitute(a, vars))
        .chain([v.main_class.clone()])
        .chain(game.iter().map(|a| substitute(a, vars)))
        .collect()
}

pub fn command(plan: &LaunchPlan, game_dir: &Path) -> tokio::process::Command {
    let mut cmd = tokio::process::Command::new(&plan.java);
    cmd.args(&plan.args)
        .current_dir(game_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    cmd
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProgressEvent {
    instance_id: String,
    stage: String,
    done: usize,
    total: usize,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LogEvent {
    instance_id: String,
    line: String,
    level: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExitEvent {
    instance_id: String,
    code: Option<i32>,
}

fn forward_logs<R>(app: AppHandle, id: String, reader: R, parse_xml: bool)
where
    R: AsyncRead + Unpin + Send + 'static,
{
    tauri::async_runtime::spawn(async move {
        let mut lines = BufReader::new(reader).lines();
        let mut parser = logs::Log4jParser::default();
        while let Ok(Some(raw)) = lines.next_line().await {
            let line = if parse_xml {
                match parser.feed(&raw) {
                    Some(l) => l,
                    None => continue,
                }
            } else {
                logs::Line {
                    text: raw,
                    level: None,
                }
            };
            let _ = app.emit(
                "game-log",
                LogEvent {
                    instance_id: id.clone(),
                    line: line.text,
                    level: line.level,
                },
            );
        }
    });
}

#[tauri::command]
pub async fn launch_instance(app: AppHandle, state: State<'_, AppState>, id: String) -> Result<()> {
    {
        let mut running = state.running.lock().await;
        if running.contains_key(&id) {
            return Err(msg("This instance is already running."));
        }
        // Reserve the slot so a double click can't launch twice.
        running.insert(id.clone(), None);
    }
    let result = start(&app, &state, &id).await;
    if result.is_err() {
        state.running.lock().await.remove(&id);
    }
    result
}

async fn start(app: &AppHandle, state: &AppState, id: &str) -> Result<()> {
    let emit = |stage: &str, done: usize, total: usize| {
        let _ = app.emit(
            "launch-progress",
            ProgressEvent {
                instance_id: id.to_string(),
                stage: stage.to_string(),
                done,
                total,
            },
        );
    };

    let mut inst = instances::load(&state.paths, id)?;
    emit("Signing in", 0, 0);
    let creds = auth::credentials(state).await?;
    let settings = inst.effective_settings(&state.settings.lock().await.clone());
    let game_dir = instances::game_dir(&state.paths, id);
    let natives_dir = instances::dir(&state.paths, id).join("natives");

    let target = LaunchTarget {
        version: &inst.version,
        loader: inst.loader,
        loader_version: inst.loader_version.as_deref(),
        game_dir: &game_dir,
        natives_dir: &natives_dir,
    };
    let plan = prepare(&state.http, &state.paths, &settings, &target, &creds, emit).await?;

    // Bring Novex Client up to date with the build this launcher carries.
    crate::client::sync(&state.paths, &inst)?;
    skin::sync(
        &state.http,
        &game_dir,
        &creds.name,
        creds.user_type == "legacy",
    )
    .await;
    {
        let global = state.settings.lock().await;
        crate::game_options::apply(
            &state.paths,
            &inst,
            &global.game_options,
            &global.game_options_legacy,
            global.template.as_ref(),
        )?;
        crate::client::apply(
            &state.paths,
            &inst,
            &global.client_options,
            &global.client_options_legacy,
        )?;
    }
    emit("Starting", 0, 0);
    let mut child = command(&plan, &game_dir).spawn().map_err(|e| {
        msg(format!(
            "Couldn't start Java at {}: {e}",
            plan.java.display()
        ))
    })?;

    if let Some(pid) = child.id() {
        state.monitor.start(
            id,
            stats::Session {
                pid,
                started_at: now_secs(),
                max_memory_mb: settings.max_memory_mb,
            },
        );
    }

    inst.last_played = Some(now_secs());
    instances::save(&state.paths, &inst)?;

    if let Some(out) = child.stdout.take() {
        forward_logs(app.clone(), id.to_string(), out, true);
    }
    if let Some(err) = child.stderr.take() {
        forward_logs(app.clone(), id.to_string(), err, false);
    }

    let (kill_tx, kill_rx) = oneshot::channel::<()>();
    state
        .running
        .lock()
        .await
        .insert(id.to_string(), Some(kill_tx));

    let app = app.clone();
    let id = id.to_string();
    tauri::async_runtime::spawn(async move {
        let started = Instant::now();
        let status = tokio::select! {
            s = child.wait() => s.ok(),
            _ = kill_rx => {
                let _ = child.kill().await;
                child.wait().await.ok()
            }
        };
        let state = app.state::<AppState>();
        state.running.lock().await.remove(&id);
        state.monitor.end(&id);
        if let Ok(mut inst) = instances::load(&state.paths, &id) {
            inst.play_time_secs += started.elapsed().as_secs();
            let _ = instances::save(&state.paths, &inst);
        }
        let _ = app.emit(
            "game-exited",
            ExitEvent {
                instance_id: id,
                code: status.and_then(|s| s.code()),
            },
        );
    });
    Ok(())
}

#[tauri::command]
pub async fn kill_instance(state: State<'_, AppState>, id: String) -> Result<()> {
    if let Some(slot) = state.running.lock().await.get_mut(&id) {
        if let Some(tx) = slot.take() {
            let _ = tx.send(());
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn running_instances(state: State<'_, AppState>) -> Result<Vec<String>> {
    Ok(state.running.lock().await.keys().cloned().collect())
}
