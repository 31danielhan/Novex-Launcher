//! Personal version backgrounds: images in `<data>/backgrounds`, named like `1.21.png` or `26.webp`.
//! They're read while the launcher runs, so they stay on this computer and are never part of a build.

use std::path::{Path, PathBuf};

use base64::Engine;
use tauri::State;

use crate::error::Result;
use crate::AppState;

const TYPES: [(&str, &str); 4] = [
    ("png", "image/png"),
    ("jpg", "image/jpeg"),
    ("jpeg", "image/jpeg"),
    ("webp", "image/webp"),
];

/// A version key is digits and dots, so it can't point outside the folder.
fn valid_key(key: &str) -> bool {
    !key.is_empty() && key.len() <= 8 && key.chars().all(|c| c.is_ascii_digit() || c == '.')
}

fn find(dir: &Path, key: &str) -> Option<(PathBuf, &'static str)> {
    if !valid_key(key) {
        return None;
    }
    TYPES.iter().find_map(|(ext, mime)| {
        let path = dir.join(format!("{key}.{ext}"));
        path.is_file().then_some((path, *mime))
    })
}

/// The image for a version key as a data URL, or nothing if the folder has none.
#[tauri::command]
pub async fn background_get(state: State<'_, AppState>, key: String) -> Result<Option<String>> {
    let Some((path, mime)) = find(&state.paths.root.join("backgrounds"), &key) else {
        return Ok(None);
    };
    let bytes = tokio::fs::read(path).await?;
    let data = base64::engine::general_purpose::STANDARD.encode(bytes);
    Ok(Some(format!("data:{mime};base64,{data}")))
}

/// The backgrounds folder, created if needed.
#[tauri::command]
pub fn backgrounds_folder(state: State<'_, AppState>) -> Result<String> {
    let dir = state.paths.root.join("backgrounds");
    std::fs::create_dir_all(&dir)?;
    Ok(dir.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keys_stay_inside_the_folder() {
        assert!(valid_key("1.21"));
        assert!(valid_key("26"));
        assert!(!valid_key(""));
        assert!(!valid_key("../x"));
        assert!(!valid_key("a/b"));
    }

    #[test]
    fn finds_supported_images_only() {
        let dir = std::env::temp_dir().join(format!("novex-bg-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("1.8.webp"), b"x").unwrap();
        std::fs::write(dir.join("1.9.gif"), b"x").unwrap();
        assert_eq!(find(&dir, "1.8").map(|f| f.1), Some("image/webp"));
        assert!(find(&dir, "1.9").is_none());
        std::fs::remove_dir_all(dir).unwrap();
    }
}
