//! Headless smoke test of the launch pipeline with an offline account.
//!
//!   cargo run --example launch -- <version|latest> <data-dir> [seconds]
//!
//! Downloads everything into <data-dir>, starts the game, prints its log and stops it
//! after [seconds] (default 60). Exits non-zero if the game never reaches the title screen.

use std::time::Duration;

use novex_launcher_lib::{auth::Credentials, downloads, game, platform::Paths, settings::Settings};
use tokio::io::{AsyncBufReadExt, BufReader};

#[tokio::main(flavor = "multi_thread")]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut args = std::env::args().skip(1);
    let version = args.next().unwrap_or_else(|| "latest".into());
    let root = std::path::PathBuf::from(
        args.next()
            .ok_or("usage: launch <version> <data-dir> [seconds]")?,
    );
    let secs: u64 = args.next().and_then(|s| s.parse().ok()).unwrap_or(60);

    let http = downloads::http_client();
    let paths = Paths { root: root.clone() };
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
    println!("== Minecraft {version}");

    let creds = Credentials {
        name: "NovexTest".into(),
        uuid: "00000000000000000000000000000000".into(),
        access_token: "0".into(),
        user_type: "legacy",
    };
    let game_dir = root.join("instances/smoke/minecraft");
    let natives = root.join("instances/smoke/natives");
    let plan = game::prepare(
        &http,
        &paths,
        &Settings::default(),
        &version,
        &game_dir,
        &natives,
        &creds,
        |stage, d, t| {
            if t == 0 || d == t {
                println!("== {stage} {d}/{t}");
            }
        },
    )
    .await?;
    println!("== java: {}", plan.java.display());

    let mut child = game::command(&plan, &game_dir).spawn()?;
    let mut parser = game::logs::Log4jParser::default();
    let mut out = BufReader::new(child.stdout.take().unwrap()).lines();
    let mut err = BufReader::new(child.stderr.take().unwrap()).lines();
    let deadline = tokio::time::sleep(Duration::from_secs(secs));
    tokio::pin!(deadline);
    let mut reached_menu = false;
    loop {
        tokio::select! {
            Ok(Some(l)) = out.next_line() => if let Some(l) = parser.feed(&l) {
                // Printed once resources load, i.e. the title screen is up.
                if l.text.contains("Sound engine started") || l.text.contains("Created:") {
                    reached_menu = true;
                }
                println!("{}", l.text);
            },
            Ok(Some(l)) = err.next_line() => eprintln!("{l}"),
            s = child.wait() => { println!("== game exited: {:?}", s?); break; }
            _ = &mut deadline => { println!("== stopping after {secs}s"); child.kill().await?; break; }
        }
    }
    println!("== reached title screen: {reached_menu}");
    if !reached_menu {
        std::process::exit(1);
    }
    Ok(())
}
