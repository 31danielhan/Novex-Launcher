//! Exercises interface updates end to end against a manifest served over HTTP.
//!
//!   NOVEX_UI_MANIFEST_URL=http://127.0.0.1:8000/ui-bundle.json \
//!     cargo run --example ui_bundle -- <data-dir> <expected-text-in-index.html>
//!
//! Checks: an update is offered, downloads and verifies, survives a good start, is dropped
//! after a start that never reported in, is rejected when tampered with, and isn't offered
//! to an app that is already newer.

use std::path::PathBuf;

use novex_launcher_lib::{downloads, platform::Paths, update::ui};
use semver::Version;

fn pubkey() -> String {
    let conf: serde_json::Value =
        serde_json::from_str(include_str!("../tauri.conf.json")).expect("tauri.conf.json");
    conf["plugins"]["updater"]["pubkey"]
        .as_str()
        .expect("updater pubkey")
        .to_string()
}

fn ok(label: &str, pass: bool) {
    println!("{} {label}", if pass { "PASS" } else { "FAIL" });
    if !pass {
        std::process::exit(1);
    }
}

#[tokio::main(flavor = "multi_thread")]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut args = std::env::args().skip(1);
    let root = PathBuf::from(args.next().ok_or("usage: ui_bundle <data-dir> <text>")?);
    let expected = args.next().ok_or("usage: ui_bundle <data-dir> <text>")?;
    let paths = Paths { root: root.clone() };
    let http = downloads::http_client();
    let key = pubkey();
    let app = Version::parse(env!("CARGO_PKG_VERSION"))?;
    let _ = std::fs::remove_dir_all(root.join("ui"));

    let offered = ui::check(&http, None, &app).await?;
    println!("offered: {offered:?}");
    ok("an update is offered", offered.is_some());

    let bundle = ui::download(&http, &paths, &key, &app).await?;
    let html = String::from_utf8_lossy(bundle.file("/index.html").unwrap_or_default()).into_owned();
    ok("downloaded bundle verifies and unpacks", true);
    let js = bundle_text(&bundle, &html);
    ok(
        "bundle contains the changed interface",
        js.contains(&expected),
    );

    let again = ui::check(&http, Some(&bundle.version), &app).await?;
    ok("the same version isn't offered again", again.is_none());

    ui::boot_ok(&paths);
    ok(
        "kept after the interface starts",
        ui::read_stored(&paths, &key, &app).is_some(),
    );
    ok(
        "dropped when the next start never reports in",
        ui::read_stored(&paths, &key, &app).is_none() && !root.join("ui").exists(),
    );

    ui::download(&http, &paths, &key, &app).await?;
    ui::boot_ok(&paths);
    let zip = root.join("ui/bundle.zip");
    let mut bytes = std::fs::read(&zip)?;
    let mid = bytes.len() / 2;
    bytes[mid] ^= 0xff;
    std::fs::write(&zip, bytes)?;
    ok(
        "a tampered bundle on disk is rejected and deleted",
        ui::read_stored(&paths, &key, &app).is_none() && !zip.exists(),
    );

    let newer_app = Version::parse(&bundle.version)?;
    ok(
        "not offered to an app that is already as new",
        ui::check(&http, None, &newer_app).await?.is_none(),
    );
    ok(
        "and refused if downloaded anyway",
        ui::download(&http, &paths, &key, &newer_app).await.is_err(),
    );
    Ok(())
}

/// index.html plus the JS files it references, as text.
fn bundle_text(bundle: &ui::Bundle, html: &str) -> String {
    let mut out = html.to_string();
    for part in html.split("src=\"").skip(1) {
        if let Some(src) = part.split('"').next() {
            if let Some(f) = bundle.file(src) {
                out.push_str(&String::from_utf8_lossy(f));
            }
        }
    }
    out
}
