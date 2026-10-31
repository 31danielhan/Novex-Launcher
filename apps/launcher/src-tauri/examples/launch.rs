//! Headless smoke test of the launch pipeline with an offline account.
//!
//!   cargo run --example launch -- <version|latest> <data-dir> [seconds] [loader] [loader-version]
//!   cargo run --example launch -- instance:<id> <data-dir> [seconds]
//!
//! Downloads everything into <data-dir>, starts the game, prints its log and stops it
//! after [seconds] (default 60). `loader` is vanilla|fabric|quilt|forge|neoforge; the loader
//! version defaults to the recommended/newest stable one. Exits non-zero unless the game
//! reached the title screen and was still running at the deadline.

use std::time::Duration;

use novex_launcher_lib::{
    auth::Credentials,
    downloads, game, instances,
    loaders::{self, LoaderKind},
    platform::Paths,
    settings::Settings,
};
use tokio::io::{AsyncBufReadExt, BufReader};

const USAGE: &str = "usage: launch <version> <data-dir> [seconds] [loader] [loader-version]";

#[tokio::main(flavor = "multi_thread")]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut args = std::env::args().skip(1);
    let version = args.next().unwrap_or_else(|| "latest".into());
    let root = std::path::PathBuf::from(args.next().ok_or(USAGE)?);
    let secs: u64 = args.next().and_then(|s| s.parse().ok()).unwrap_or(60);
    let mut loader: LoaderKind = match args.next() {
        Some(l) => serde_json::from_value(serde_json::Value::String(l)).map_err(|_| USAGE)?,
        None => LoaderKind::Vanilla,
    };
    let mut loader_version = args.next();

    let http = downloads::http_client();
    let paths = Paths { root: root.clone() };
    // An existing instance (e.g. an installed modpack) launches from its own folder.
    let existing = match version.strip_prefix("instance:") {
        Some(id) => Some(instances::load(&paths, id)?),
        None => None,
    };
    let version = match &existing {
        Some(inst) => {
            loader = inst.loader;
            loader_version = inst.loader_version.clone();
            inst.version.clone()
        }
        None => version,
    };
    let version = if version == "latest" {
        let m: serde_json::Value = downloads::get_json(
            &http,
            "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",
        )
        .await?;
        m["latest"]["release"]
            .as_str()
            .unwrap_or_default()
            .to_string()
    } else {
        version
    };
    if loader != LoaderKind::Vanilla && loader_version.is_none() {
        let list = loaders::versions(&http, loader, &version).await?;
        loader_version = Some(
            list.first()
                .ok_or_else(|| format!("{} has no build for {version}", loader.label()))?
                .id
                .clone(),
        );
    }
    println!(
        "== Minecraft {version} · {} {}",
        loader.label(),
        loader_version.as_deref().unwrap_or("")
    );

    let creds = Credentials {
        name: "NovexTest".into(),
        uuid: "00000000000000000000000000000000".into(),
        access_token: "0".into(),
        user_type: "legacy",
    };
    let instance = match &existing {
        Some(inst) => format!("instances/{}", inst.id),
        None => format!("instances/smoke-{}", loader.label().to_lowercase()),
    };
    let game_dir = root.join(&instance).join("minecraft");
    let natives = root.join(&instance).join("natives");
    let target = game::LaunchTarget {
        version: &version,
        loader,
        loader_version: loader_version.as_deref(),
        game_dir: &game_dir,
        natives_dir: &natives,
    };
    // NOVEX_JVM_ARGS adds JVM flags and NOVEX_JAVA picks a Java binary, for trying out fixes.
    let settings = Settings {
        jvm_args: std::env::var("NOVEX_JVM_ARGS").unwrap_or_default(),
        java_path: std::env::var("NOVEX_JAVA").ok(),
        ..Settings::default()
    };
    let plan = game::prepare(&http, &paths, &settings, &target, &creds, |stage, d, t| {
        if t == 0 || d == t {
            println!("== {stage} {d}/{t}");
        }
    })
    .await?;
    println!("== java: {}", plan.java.display());

    let mut child = game::command(&plan, &game_dir).spawn()?;
    let mut parser = game::logs::Log4jParser::default();
    let mut out = BufReader::new(child.stdout.take().unwrap()).lines();
    let mut err = BufReader::new(child.stderr.take().unwrap()).lines();
    let deadline = tokio::time::sleep(Duration::from_secs(secs));
    tokio::pin!(deadline);
    let mut reached_menu = false;
    let mut alive_at_deadline = false;
    loop {
        tokio::select! {
            Ok(Some(l)) = out.next_line() => if let Some(l) = parser.feed(&l) {
                // Printed once resources load, i.e. the title screen is up.
                if l.text.contains("Sound engine started") {
                    reached_menu = true;
                }
                println!("{}", l.text);
            },
            Ok(Some(l)) = err.next_line() => eprintln!("{l}"),
            s = child.wait() => { println!("== game exited: {:?}", s?); break; }
            _ = &mut deadline => {
                println!("== stopping after {secs}s");
                alive_at_deadline = true;
                child.kill().await?;
                break;
            }
        }
    }
    println!("== reached title screen: {reached_menu}, still running: {alive_at_deadline}");
    if !(reached_menu && alive_at_deadline) {
        std::process::exit(1);
    }
    Ok(())
}
