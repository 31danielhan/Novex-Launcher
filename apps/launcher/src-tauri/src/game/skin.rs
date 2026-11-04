//! Lets an offline account wear the skin of the Minecraft player with its name.
//!
//! The game can't fetch a skin without a real session, so before launch the skin is downloaded
//! into the instance's config folder, where Novex Client applies it. Only the player's own game
//! shows it; a skin is never needed to play, so failures here don't stop a launch.

use std::path::Path;
use std::time::Duration;

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use reqwest::Client;
use serde_json::Value;
use tauri::State;

use crate::error::Result;
use crate::AppState;

const IMAGE: &str = "novex-skin.png";
/// Two lines: the account name, then "slim" or "wide".
const INFO: &str = "novex-skin.txt";
const TIMEOUT: Duration = Duration::from_secs(5);

struct Skin {
    png: Vec<u8>,
    slim: bool,
}

/// The skin URL and arm model in a profile's base64 `textures` property.
fn parse_textures(encoded: &str) -> Option<(String, bool)> {
    let json: Value = serde_json::from_slice(&B64.decode(encoded).ok()?).ok()?;
    let skin = &json["textures"]["SKIN"];
    Some((
        skin["url"].as_str()?.to_string(),
        skin["metadata"]["model"] == "slim",
    ))
}

/// Pre-1.8 skins are 64x32, which needs converting before it can be used as a texture.
fn is_square_png(png: &[u8]) -> bool {
    let size = |at: usize| {
        png.get(at..at + 4)
            .map(|b| u32::from_be_bytes([b[0], b[1], b[2], b[3]]))
    };
    png.starts_with(b"\x89PNG\r\n\x1a\n") && size(16).is_some() && size(16) == size(20)
}

async fn get_json(http: &Client, url: &str) -> reqwest::Result<Option<Value>> {
    let response = http.get(url).timeout(TIMEOUT).send().await?;
    if matches!(response.status().as_u16(), 204 | 404) {
        return Ok(None);
    }
    Ok(Some(response.error_for_status()?.json().await?))
}

/// `Ok(None)` means Mojang answered and this name has no usable skin.
async fn fetch(http: &Client, name: &str) -> reqwest::Result<Option<Skin>> {
    let url = format!("https://api.mojang.com/users/profiles/minecraft/{name}");
    let Some(user) = get_json(http, &url).await? else {
        return Ok(None);
    };
    let Some(id) = user["id"].as_str() else {
        return Ok(None);
    };
    let url = format!("https://sessionserver.mojang.com/session/minecraft/profile/{id}");
    let Some(profile) = get_json(http, &url).await? else {
        return Ok(None);
    };
    let textures = profile["properties"].as_array().and_then(|list| {
        let property = list.iter().find(|p| p["name"] == "textures")?;
        parse_textures(property["value"].as_str()?)
    });
    let Some((url, slim)) = textures else {
        return Ok(None);
    };
    let response = http.get(url).timeout(TIMEOUT).send().await?;
    let png = response.error_for_status()?.bytes().await?.to_vec();
    Ok(Some(Skin { png, slim }))
}

fn clear(config: &Path) {
    let _ = std::fs::remove_file(config.join(IMAGE));
    let _ = std::fs::remove_file(config.join(INFO));
}

fn cached_for(config: &Path, name: &str) -> bool {
    std::fs::read_to_string(config.join(INFO)).is_ok_and(|info| info.lines().next() == Some(name))
}

/// Before a launch: fetch the skin for an offline account, or clear it for any other. Offline
/// play keeps the last skin fetched for this name.
pub async fn sync(http: &Client, game_dir: &Path, name: &str, offline: bool) {
    let config = game_dir.join("config");
    if !offline {
        return clear(&config);
    }
    match fetch(http, name).await {
        Ok(Some(skin)) if is_square_png(&skin.png) => {
            let info = format!("{name}\n{}\n", if skin.slim { "slim" } else { "wide" });
            let written = std::fs::create_dir_all(&config)
                .and_then(|_| std::fs::write(config.join(IMAGE), &skin.png))
                .and_then(|_| std::fs::write(config.join(INFO), info));
            if let Err(e) = written {
                eprintln!("[skin] couldn't save the skin for {name}: {e}");
                clear(&config);
            }
        }
        Ok(_) => clear(&config),
        Err(e) => {
            eprintln!("[skin] couldn't fetch the skin for {name}: {e}");
            if !cached_for(&config, name) {
                clear(&config);
            }
        }
    }
}

/// A player's skin as base64 PNG for the launcher to draw their face from, or None if the name
/// has no skin. The last one fetched is kept for when Mojang can't be reached.
#[tauri::command]
pub async fn account_skin(state: State<'_, AppState>, name: String) -> Result<Option<String>> {
    if !name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
        return Ok(None);
    }
    let dir = state.paths.root.join("skins");
    let file = dir.join(format!("{}.png", name.to_lowercase()));
    match fetch(&state.http, &name).await {
        Ok(Some(skin)) => {
            std::fs::create_dir_all(&dir)?;
            std::fs::write(&file, &skin.png)?;
            Ok(Some(B64.encode(skin.png)))
        }
        Ok(None) => {
            let _ = std::fs::remove_file(&file);
            Ok(None)
        }
        Err(_) => Ok(std::fs::read(&file).ok().map(|png| B64.encode(png))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_url_and_model() {
        let json = r#"{"textures":{"SKIN":{"url":"http://t/a","metadata":{"model":"slim"}}}}"#;
        assert_eq!(
            parse_textures(&B64.encode(json)),
            Some(("http://t/a".to_string(), true))
        );
        let json = r#"{"textures":{"SKIN":{"url":"http://t/b"}}}"#;
        assert_eq!(
            parse_textures(&B64.encode(json)),
            Some(("http://t/b".to_string(), false))
        );
        assert_eq!(parse_textures(&B64.encode(r#"{"textures":{}}"#)), None);
    }

    #[test]
    fn only_square_pngs_are_used() {
        let png = |w: u32, h: u32| {
            let mut b = b"\x89PNG\r\n\x1a\n\0\0\0\x0dIHDR".to_vec();
            b.extend(w.to_be_bytes());
            b.extend(h.to_be_bytes());
            b
        };
        assert!(is_square_png(&png(64, 64)));
        assert!(!is_square_png(&png(64, 32)));
        assert!(!is_square_png(b"not a png"));
    }

    #[test]
    fn a_failed_fetch_only_keeps_this_names_skin() {
        let dir = std::env::temp_dir().join(format!("novex-skin-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join(INFO), "Steve\nslim\n").unwrap();
        assert!(cached_for(&dir, "Steve"));
        assert!(!cached_for(&dir, "Alex"));
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
