//! Tries the content pipeline against the real Modrinth/CurseForge APIs.
//!
//!   cargo run --example content -- search <source> <kind> <query> [game-version] [loader]
//!   cargo run --example content -- create <data-dir> <name> <game-version> [loader]
//!   cargo run --example content -- install <data-dir> <instance-id> <source> <kind> <project>
//!   cargo run --example content -- list <data-dir> <instance-id>
//!   cargo run --example content -- disable|enable|remove <data-dir> <instance-id> <kind> <file>
//!   cargo run --example content -- modpack <data-dir> <source> <project> [version-id]
//!   cargo run --example content -- import <data-dir> <file>
//!
//! source: modrinth|curseforge, kind: modpack|mod|resourcepack|shader.
//! Launch a created instance with `cargo run --example launch -- instance:<id> <data-dir>`.

use std::path::PathBuf;

use novex_launcher_lib::{
    content::{self, modpack, ContentKind, SearchQuery, Source},
    downloads, instances,
    loaders::{self, LoaderKind},
    platform::Paths,
};

fn parse<T: serde::de::DeserializeOwned>(s: &str) -> Result<T, Box<dyn std::error::Error>> {
    Ok(serde_json::from_value(serde_json::Value::String(s.into()))?)
}

#[tokio::main(flavor = "multi_thread")]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let arg = |i: usize| {
        args.get(i)
            .map(String::as_str)
            .ok_or("missing argument (see the file header)")
    };
    let http = downloads::http_client();
    let paths = |i: usize| -> Result<Paths, Box<dyn std::error::Error>> {
        Ok(Paths {
            root: PathBuf::from(arg(i)?),
        })
    };
    let progress = |stage: &str, d: usize, t: usize| {
        if t == 0 || d == t {
            println!("== {stage} {d}/{t}");
        }
    };

    match arg(0)? {
        "search" => {
            let q = SearchQuery {
                source: parse(arg(1)?)?,
                kind: parse(arg(2)?)?,
                query: arg(3)?.into(),
                game_version: args.get(4).cloned(),
                loader: args.get(5).map(|l| parse(l)).transpose()?,
                offset: 0,
            };
            let page = content::search(&http, &q).await?;
            println!("{} results", page.total);
            for h in page.hits.iter().take(8) {
                println!(
                    "{:>12}  {:<32} {:>10} dl  {}",
                    h.id, h.title, h.downloads, h.author
                );
            }
        }
        "create" => {
            let p = paths(1)?;
            let loader: LoaderKind = args
                .get(4)
                .map(|l| parse(l))
                .transpose()?
                .unwrap_or_default();
            let lv = match loader {
                LoaderKind::Vanilla => None,
                l => Some(
                    loaders::versions(&http, l, arg(3)?)
                        .await?
                        .first()
                        .ok_or("no loader build")?
                        .id
                        .clone(),
                ),
            };
            let inst = instances::create(&p, arg(2)?, arg(3)?.into(), loader, lv, None)?;
            println!("created {}", inst.id);
        }
        "install" => {
            let p = paths(1)?;
            let inst = instances::load(&p, arg(2)?)?;
            let source: Source = parse(arg(3)?)?;
            let kind: ContentKind = parse(arg(4)?)?;
            let done = content::install(&http, &p, &inst, source, arg(5)?, kind, None).await?;
            println!("installed: {}", done.join(", "));
        }
        "list" => {
            for i in content::list_installed(&paths(1)?, arg(2)?)? {
                println!(
                    "{:<12?} {:<5} {:<36} {:<20} {}",
                    i.kind,
                    i.enabled,
                    i.title,
                    i.version.unwrap_or_default(),
                    i.file
                );
            }
        }
        cmd @ ("disable" | "enable" | "remove") => {
            let (p, id, kind, file) = (paths(1)?, arg(2)?, parse(arg(3)?)?, arg(4)?);
            match cmd {
                "remove" => content::remove(&p, id, kind, file)?,
                c => content::set_enabled(&p, id, kind, file, c == "enable")?,
            }
            println!("{cmd}d {file}");
        }
        "modpack" => {
            let r = modpack::install_from_source(
                &http,
                &paths(1)?,
                parse(arg(2)?)?,
                arg(3)?,
                args.get(4).map(String::as_str),
                progress,
            )
            .await?;
            println!("created {} (skipped: {:?})", r.instance.id, r.skipped);
        }
        "import" => {
            let r =
                modpack::install_file(&http, &paths(1)?, arg(2)?.as_ref(), None, progress).await?;
            println!("created {} (skipped: {:?})", r.instance.id, r.skipped);
        }
        other => return Err(format!("unknown command {other}").into()),
    }
    Ok(())
}
