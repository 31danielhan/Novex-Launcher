//! Game settings shared by every instance, so a new instance plays the way the others do.
//!
//! Two parts:
//! - Options set on the launcher's Game settings tab (video, controls and keybinds, chat, sound,
//!   skin, accessibility). Before each launch they're written into the instance's `options.txt`,
//!   replacing only those lines. The format of each one is converted for the instance's version,
//!   and options a version doesn't have are skipped. They're the vanilla options Sodium and other
//!   performance mods read too, so those mods pick them up; their own config files are untouched.
//!   1.8 has its own page: on versions before 1.9 its values win over the shared ones, and it adds
//!   the options only those versions have.
//! - A template: one instance's whole `options.txt` and, optionally, its `config` folder (mod
//!   settings such as Sodium's), copied into instances that don't have their own yet. Keybinds are
//!   stored differently before 1.13, so a template only goes to instances on the same side of it.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::State;

use crate::error::{msg, Result};
use crate::instances::{self, Instance};
use crate::platform::Paths;
use crate::AppState;

/// Option id (the `options.txt` key, or `key_key.*` for keybinds) to value, as the Game settings
/// tab stores it: bools, numbers in the units shown there (percent, degrees), strings.
pub type GameOptions = BTreeMap<String, Value>;

/// The instance a template was taken from.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateInfo {
    pub name: String,
    pub version: String,
    pub include_config: bool,
}

pub(crate) type Version = (u32, u32, u32);

pub(crate) fn version(v: &str) -> Version {
    let mut parts = v
        .split(|c: char| !c.is_ascii_digit())
        .filter(|p| !p.is_empty())
        .map(|p| p.parse().unwrap_or(0));
    (
        parts.next().unwrap_or(0),
        parts.next().unwrap_or(0),
        parts.next().unwrap_or(0),
    )
}

/// How a value is written into `options.txt`.
#[derive(Clone, Copy)]
enum Format {
    Bool,
    Int,
    /// Percent in the launcher, 0..1 in the file.
    Percent,
    /// Percent in the launcher, 0..1 in the file where 0.5 is 100% (mouse sensitivity).
    HalfPercent,
    /// Degrees in the launcher, -1..1 around 70 in the file.
    Fov,
    /// A plain number written as is (scales like chat width).
    Float,
    /// Text, quoted from 1.19 on.
    Text,
    /// Smooth lighting: true/false from 1.19, 0 or 2 before. The 1.8 page stores the level itself
    /// (0 off, 1 minimum, 2 maximum).
    SmoothLighting,
    /// Clouds: "true"/"fast"/"false", quoted from 1.19.
    Clouds,
    /// "fast", "fancy" or "fabulous": a preset in 26.x, a number 1.16-1.21, a bool before.
    Graphics,
    /// Language code, with an uppercase region before 1.11 (en_US).
    Language,
    /// A key name like key.keyboard.w; LWJGL key codes before 1.13.
    Key,
}

/// (id, format, first version that has it).
const CATALOG: &[(&str, Format, Version)] = &[
    // Video Settings
    ("graphics", Format::Graphics, (1, 0, 0)),
    ("renderDistance", Format::Int, (1, 0, 0)),
    ("simulationDistance", Format::Int, (1, 18, 0)),
    ("maxFps", Format::Int, (1, 0, 0)),
    ("enableVsync", Format::Bool, (1, 0, 0)),
    ("fullscreen", Format::Bool, (1, 0, 0)),
    ("guiScale", Format::Int, (1, 0, 0)),
    ("gamma", Format::Percent, (1, 0, 0)),
    ("ao", Format::SmoothLighting, (1, 0, 0)),
    ("renderClouds", Format::Clouds, (1, 0, 0)),
    ("particles", Format::Int, (1, 0, 0)),
    ("mipmapLevels", Format::Int, (1, 0, 0)),
    ("entityShadows", Format::Bool, (1, 0, 0)),
    ("bobView", Format::Bool, (1, 0, 0)),
    ("attackIndicator", Format::Int, (1, 9, 0)),
    ("biomeBlendRadius", Format::Int, (1, 13, 0)),
    ("entityDistanceScaling", Format::Percent, (1, 16, 0)),
    ("fovEffectScale", Format::Percent, (1, 16, 0)),
    ("screenEffectScale", Format::Percent, (1, 16, 0)),
    ("fov", Format::Fov, (1, 0, 0)),
    // Controls
    ("mouseSensitivity", Format::HalfPercent, (1, 0, 0)),
    ("invertYMouse", Format::Bool, (1, 0, 0)),
    ("discrete_mouse_scroll", Format::Bool, (1, 13, 0)),
    ("mouseWheelSensitivity", Format::Float, (1, 13, 0)),
    ("autoJump", Format::Bool, (1, 11, 0)),
    ("toggleCrouch", Format::Bool, (1, 15, 0)),
    ("toggleSprint", Format::Bool, (1, 15, 0)),
    // Chat Settings
    ("chatVisibility", Format::Int, (1, 0, 0)),
    ("chatColors", Format::Bool, (1, 0, 0)),
    ("chatLinks", Format::Bool, (1, 0, 0)),
    ("chatLinksPrompt", Format::Bool, (1, 0, 0)),
    ("chatOpacity", Format::Percent, (1, 0, 0)),
    ("textBackgroundOpacity", Format::Percent, (1, 13, 0)),
    ("chatScale", Format::Percent, (1, 0, 0)),
    ("chatLineSpacing", Format::Percent, (1, 16, 0)),
    ("chatDelay", Format::Float, (1, 16, 0)),
    ("chatWidth", Format::Percent, (1, 0, 0)),
    ("chatHeightFocused", Format::Percent, (1, 0, 0)),
    ("chatHeightUnfocused", Format::Percent, (1, 0, 0)),
    ("narrator", Format::Int, (1, 12, 0)),
    ("autoSuggestions", Format::Bool, (1, 13, 0)),
    ("hideMatchedNames", Format::Bool, (1, 16, 0)),
    ("onlyShowSecureChat", Format::Bool, (1, 19, 0)),
    ("reducedDebugInfo", Format::Bool, (1, 8, 0)),
    // Music & Sounds
    ("soundCategory_master", Format::Percent, (1, 0, 0)),
    ("soundCategory_music", Format::Percent, (1, 0, 0)),
    ("soundCategory_record", Format::Percent, (1, 0, 0)),
    ("soundCategory_weather", Format::Percent, (1, 0, 0)),
    ("soundCategory_block", Format::Percent, (1, 0, 0)),
    ("soundCategory_hostile", Format::Percent, (1, 0, 0)),
    ("soundCategory_neutral", Format::Percent, (1, 0, 0)),
    ("soundCategory_player", Format::Percent, (1, 0, 0)),
    ("soundCategory_ambient", Format::Percent, (1, 0, 0)),
    ("soundCategory_voice", Format::Percent, (1, 9, 0)),
    ("showSubtitles", Format::Bool, (1, 9, 0)),
    ("directionalAudio", Format::Bool, (1, 19, 0)),
    // Skin Customization
    ("modelPart_cape", Format::Bool, (1, 8, 0)),
    ("modelPart_jacket", Format::Bool, (1, 8, 0)),
    ("modelPart_left_sleeve", Format::Bool, (1, 8, 0)),
    ("modelPart_right_sleeve", Format::Bool, (1, 8, 0)),
    ("modelPart_left_pants_leg", Format::Bool, (1, 8, 0)),
    ("modelPart_right_pants_leg", Format::Bool, (1, 8, 0)),
    ("modelPart_hat", Format::Bool, (1, 8, 0)),
    ("mainHand", Format::Text, (1, 9, 0)),
    // Language
    ("lang", Format::Language, (1, 0, 0)),
    // Accessibility Settings
    ("darknessEffectScale", Format::Percent, (1, 19, 0)),
    ("damageTiltStrength", Format::Percent, (1, 19, 4)),
    ("glintSpeed", Format::Percent, (1, 19, 0)),
    ("glintStrength", Format::Percent, (1, 19, 0)),
    ("hideLightningFlashes", Format::Bool, (1, 19, 0)),
    ("highContrast", Format::Bool, (1, 19, 4)),
    ("panoramaScrollSpeed", Format::Float, (1, 19, 0)),
    // Only on the 1.8 page, so never written to newer versions.
    ("anaglyph3d", Format::Bool, (1, 0, 0)),
    ("useVbo", Format::Bool, (1, 0, 0)),
    ("allowBlockAlternatives", Format::Bool, (1, 0, 0)),
    ("forceUnicodeFont", Format::Bool, (1, 0, 0)),
    ("touchscreen", Format::Bool, (1, 0, 0)),
    ("snooperEnabled", Format::Bool, (1, 0, 0)),
    ("realmsNotifications", Format::Bool, (1, 0, 0)),
    ("advancedItemTooltips", Format::Bool, (1, 0, 0)),
    ("heldItemTooltips", Format::Bool, (1, 0, 0)),
    ("pauseOnLostFocus", Format::Bool, (1, 0, 0)),
];

/// Keybinds whose action only exists from some version on.
const KEY_SINCE: &[(&str, Version)] = &[
    ("key_key.swapOffhand", (1, 9, 0)),
    ("key_key.spectatorOutlines", (1, 8, 0)),
    ("key_key.advancements", (1, 12, 0)),
    ("key_key.saveToolbarActivator", (1, 12, 0)),
    ("key_key.loadToolbarActivator", (1, 12, 0)),
    ("key_key.socialInteractions", (1, 16, 0)),
];

fn float(v: f64) -> String {
    let s = format!("{v:.4}");
    let s = s.trim_end_matches('0').trim_end_matches('.');
    if s.contains('.') {
        s.to_string()
    } else {
        format!("{s}.0")
    }
}

fn quoted(text: &str, v: Version) -> String {
    if v >= (1, 19, 0) {
        format!("\"{text}\"")
    } else {
        text.to_string()
    }
}

/// The `options.txt` value for one option in one version, or None to leave it alone.
fn format_value(format: Format, value: &Value, v: Version) -> Option<String> {
    let num = || value.as_f64();
    Some(match format {
        Format::Bool => value.as_bool()?.to_string(),
        Format::Int => (num()?.round() as i64).to_string(),
        Format::Percent => float(num()? / 100.0),
        Format::HalfPercent => float(num()? / 200.0),
        Format::Fov => float((num()?.clamp(30.0, 110.0) - 70.0) / 40.0),
        Format::Float => float(num()?),
        Format::Text => quoted(value.as_str()?, v),
        Format::SmoothLighting => {
            let level = value
                .as_bool()
                .map(|on| if on { 2 } else { 0 })
                .or_else(|| value.as_i64())?;
            if v >= (1, 19, 0) {
                (level > 0).to_string()
            } else {
                level.to_string()
            }
        }
        Format::Clouds => quoted(value.as_str()?, v),
        Format::Graphics => {
            let g = value.as_str()?;
            if v >= (26, 1, 0) {
                quoted(g, v)
            } else if v >= (1, 16, 0) {
                match g {
                    "fast" => "0",
                    "fabulous" => "2",
                    _ => "1",
                }
                .to_string()
            } else {
                // Fabulous didn't exist; fancy is the closest.
                (g != "fast").to_string()
            }
        }
        Format::Language => {
            let lang = value.as_str()?;
            match lang.split_once('_') {
                Some((l, r)) if v < (1, 11, 0) => format!("{l}_{}", r.to_uppercase()),
                _ => lang.to_string(),
            }
        }
        Format::Key => {
            let key = value.as_str()?;
            if v >= (1, 13, 0) {
                key.to_string()
            } else {
                lwjgl_code(key)?.to_string()
            }
        }
    })
}

/// The key names Minecraft uses from 1.13 to LWJGL 2 key codes, which it used before. Mouse
/// buttons were -100 + button.
fn lwjgl_code(name: &str) -> Option<i32> {
    if let Some(button) = name.strip_prefix("key.mouse.") {
        return match button {
            "left" => Some(-100),
            "right" => Some(-99),
            "middle" => Some(-98),
            n => n.parse::<i32>().ok().map(|b| -101 + b),
        };
    }
    let key = name.strip_prefix("key.keyboard.")?;
    const LETTERS: &str = "qwertyuiop";
    const HOME: &str = "asdfghjkl";
    const BOTTOM: &str = "zxcvbnm";
    if key.len() == 1 {
        let c = key.chars().next()?;
        if let Some(i) = LETTERS.find(c) {
            return Some(16 + i as i32);
        }
        if let Some(i) = HOME.find(c) {
            return Some(30 + i as i32);
        }
        if let Some(i) = BOTTOM.find(c) {
            return Some(44 + i as i32);
        }
        if let Some(d) = c.to_digit(10) {
            return Some(if d == 0 { 11 } else { 1 + d as i32 });
        }
    }
    if let Some(n) = key.strip_prefix('f').and_then(|n| n.parse::<i32>().ok()) {
        return match n {
            1..=10 => Some(58 + n),
            11 => Some(87),
            12 => Some(88),
            _ => None,
        };
    }
    Some(match key {
        "unknown" => 0,
        "escape" => 1,
        "minus" => 12,
        "equal" => 13,
        "backspace" => 14,
        "tab" => 15,
        "left.bracket" => 26,
        "right.bracket" => 27,
        "enter" => 28,
        "left.control" => 29,
        "semicolon" => 39,
        "apostrophe" => 40,
        "grave.accent" => 41,
        "left.shift" => 42,
        "backslash" => 43,
        "comma" => 51,
        "period" => 52,
        "slash" => 53,
        "right.shift" => 54,
        "left.alt" => 56,
        "space" => 57,
        "caps.lock" => 58,
        "right.control" => 157,
        "right.alt" => 184,
        "up" => 200,
        "left" => 203,
        "right" => 205,
        "down" => 208,
        "insert" => 210,
        "delete" => 211,
        "home" => 199,
        "end" => 207,
        "page.up" => 201,
        "page.down" => 209,
        _ => return None,
    })
}

/// `options.txt` lines for a Minecraft version, as (key, value).
pub fn lines(options: &GameOptions, mc: &str) -> Vec<(String, String)> {
    let v = version(mc);
    let mut out = Vec::new();
    for (id, value) in options {
        if value.is_null() {
            continue;
        }
        if id.starts_with("key_") {
            if KEY_SINCE.iter().any(|(k, since)| k == id && v < *since) {
                continue;
            }
            if let Some(text) = format_value(Format::Key, value, v) {
                out.push((id.clone(), text));
            }
            continue;
        }
        let Some((_, format, since)) = CATALOG.iter().find(|(key, _, _)| key == id) else {
            continue;
        };
        if v < *since {
            continue;
        }
        // Graphics has a different key in each era.
        let key = match (id.as_str(), v) {
            ("graphics", v) if v >= (26, 1, 0) => "graphicsPreset",
            ("graphics", v) if v >= (1, 16, 0) => "graphicsMode",
            ("graphics", _) => "fancyGraphics",
            (id, _) => id,
        };
        if let Some(text) = format_value(*format, value, v) {
            out.push((key.to_string(), text));
        }
    }
    out
}

/// The options for a version: the shared ones, with the 1.8 page on top for versions before 1.9.
fn for_version(options: &GameOptions, legacy: &GameOptions, mc: &str) -> GameOptions {
    let mut out = options.clone();
    if version(mc) < (1, 9, 0) {
        out.extend(legacy.iter().map(|(k, v)| (k.clone(), v.clone())));
    }
    out
}

/// Sets lines in an `options.txt`, keeping every other line as it was.
pub fn merge(existing: &str, lines: &[(String, String)]) -> String {
    let mut out: Vec<String> = existing.lines().map(str::to_string).collect();
    for (key, value) in lines {
        let prefix = format!("{key}:");
        match out.iter_mut().find(|l| l.starts_with(&prefix)) {
            Some(line) => *line = format!("{key}:{value}"),
            None => out.push(format!("{key}:{value}")),
        }
    }
    let mut text = out.join("\n");
    text.push('\n');
    text
}

fn template_dir(paths: &Paths) -> PathBuf {
    paths.root.join("options-template")
}

/// Keybinds are key names from 1.13 on and LWJGL key codes before.
fn same_keybind_format(a: &str, b: &str) -> bool {
    (version(a) >= (1, 13, 0)) == (version(b) >= (1, 13, 0))
}

fn copy_missing(from: &Path, to: &Path) -> Result<()> {
    if !from.is_dir() {
        return Ok(());
    }
    std::fs::create_dir_all(to)?;
    for entry in std::fs::read_dir(from)?.flatten() {
        let target = to.join(entry.file_name());
        if entry.path().is_dir() {
            copy_missing(&entry.path(), &target)?;
        } else if !target.exists() {
            std::fs::copy(entry.path(), &target)?;
        }
    }
    Ok(())
}

/// Before a launch: start a fresh instance from the template, then write the launcher's options.
pub fn apply(
    paths: &Paths,
    inst: &Instance,
    options: &GameOptions,
    legacy: &GameOptions,
    template: Option<&TemplateInfo>,
) -> Result<()> {
    let game = instances::game_dir(paths, &inst.id);
    let file = game.join("options.txt");
    std::fs::create_dir_all(&game)?;
    if let Some(t) = template {
        if !file.exists() && same_keybind_format(&t.version, &inst.version) {
            let dir = template_dir(paths);
            if let Ok(text) = std::fs::read_to_string(dir.join("options.txt")) {
                std::fs::write(&file, text)?;
            }
            if t.include_config {
                // Only adds files; anything the instance already has wins.
                copy_missing(&dir.join("config"), &game.join("config"))?;
            }
        }
    }
    if inst.use_game_options {
        let lines = lines(&for_version(options, legacy, &inst.version), &inst.version);
        if !lines.is_empty() {
            let existing = std::fs::read_to_string(&file).unwrap_or_default();
            std::fs::write(&file, merge(&existing, &lines))?;
        }
    }
    Ok(())
}

/// Saves an instance's `options.txt` (and optionally its `config` folder) as the template.
#[tauri::command]
pub async fn game_template_set(
    state: State<'_, AppState>,
    instance_id: String,
    include_config: bool,
) -> Result<crate::settings::Settings> {
    let inst = instances::load(&state.paths, &instance_id)?;
    let game = instances::game_dir(&state.paths, &inst.id);
    let options = game.join("options.txt");
    if !options.exists() {
        return Err(msg(format!(
            "{} has no game settings yet. Play it once, set it up in game, then try again.",
            inst.name
        )));
    }
    let dir = template_dir(&state.paths);
    if dir.exists() {
        std::fs::remove_dir_all(&dir)?;
    }
    std::fs::create_dir_all(&dir)?;
    std::fs::copy(&options, dir.join("options.txt"))?;
    if include_config {
        copy_missing(&game.join("config"), &dir.join("config"))?;
    }
    let mut settings = state.settings.lock().await;
    settings.template = Some(TemplateInfo {
        name: inst.name.clone(),
        version: inst.version.clone(),
        include_config,
    });
    settings.save(&state.paths)?;
    Ok(settings.clone())
}

#[tauri::command]
pub async fn game_template_clear(state: State<'_, AppState>) -> Result<crate::settings::Settings> {
    let dir = template_dir(&state.paths);
    if dir.exists() {
        std::fs::remove_dir_all(&dir)?;
    }
    let mut settings = state.settings.lock().await;
    settings.template = None;
    settings.save(&state.paths)?;
    Ok(settings.clone())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn opts() -> GameOptions {
        [
            ("lang", json!("en_us")),
            ("renderDistance", json!(12)),
            ("simulationDistance", json!(8)),
            ("fov", json!(90)),
            ("mouseSensitivity", json!(100)),
            ("toggleSprint", json!(true)),
            ("soundCategory_master", json!(40)),
            ("graphics", json!("fabulous")),
            ("ao", json!(true)),
            ("renderClouds", json!("fast")),
            ("mainHand", json!("left")),
            ("key_key.forward", json!("key.keyboard.e")),
            ("key_key.attack", json!("key.mouse.left")),
            ("key_key.swapOffhand", json!("key.keyboard.f")),
            ("unknownOption", json!(1)),
        ]
        .into_iter()
        .map(|(k, v)| (k.to_string(), v))
        .collect()
    }

    fn get(lines: &[(String, String)], key: &str) -> Option<String> {
        lines.iter().find(|(k, _)| k == key).map(|(_, v)| v.clone())
    }

    #[test]
    fn modern_versions() {
        let l = lines(&opts(), "26.3");
        assert_eq!(get(&l, "lang").as_deref(), Some("en_us"));
        assert_eq!(get(&l, "fov").as_deref(), Some("0.5"));
        assert_eq!(get(&l, "mouseSensitivity").as_deref(), Some("0.5"));
        assert_eq!(get(&l, "soundCategory_master").as_deref(), Some("0.4"));
        assert_eq!(get(&l, "graphicsPreset").as_deref(), Some("\"fabulous\""));
        assert_eq!(get(&l, "renderClouds").as_deref(), Some("\"fast\""));
        assert_eq!(get(&l, "mainHand").as_deref(), Some("\"left\""));
        assert_eq!(get(&l, "ao").as_deref(), Some("true"));
        assert_eq!(
            get(&l, "key_key.forward").as_deref(),
            Some("key.keyboard.e")
        );
        assert!(get(&l, "unknownOption").is_none());
        assert_eq!(
            get(&lines(&opts(), "1.20.1"), "graphicsMode").as_deref(),
            Some("2")
        );
    }

    #[test]
    fn legacy_versions() {
        let l = lines(&opts(), "1.8.9");
        assert_eq!(get(&l, "lang").as_deref(), Some("en_US"));
        assert_eq!(get(&l, "fancyGraphics").as_deref(), Some("true"));
        assert_eq!(get(&l, "ao").as_deref(), Some("2"));
        assert_eq!(get(&l, "renderClouds").as_deref(), Some("fast"));
        assert_eq!(get(&l, "key_key.forward").as_deref(), Some("18"));
        assert_eq!(get(&l, "key_key.attack").as_deref(), Some("-100"));
        for missing in [
            "simulationDistance",
            "toggleSprint",
            "mainHand",
            "key_key.swapOffhand",
        ] {
            assert!(
                get(&l, missing).is_none(),
                "{missing} shouldn't be written for 1.8.9"
            );
        }
    }

    #[test]
    fn legacy_page_only_reaches_old_versions() {
        let shared: GameOptions = [
            ("renderDistance".to_string(), json!(12)),
            ("fov".to_string(), json!(90)),
        ]
        .into();
        let legacy: GameOptions = [
            ("renderDistance".to_string(), json!(6)),
            ("useVbo".to_string(), json!(true)),
            ("ao".to_string(), json!(1)),
        ]
        .into();

        let l = lines(&for_version(&shared, &legacy, "1.8.9"), "1.8.9");
        assert_eq!(get(&l, "renderDistance").as_deref(), Some("6"));
        assert_eq!(get(&l, "fov").as_deref(), Some("0.5"));
        assert_eq!(get(&l, "useVbo").as_deref(), Some("true"));
        assert_eq!(get(&l, "ao").as_deref(), Some("1"));

        let l = lines(&for_version(&shared, &legacy, "1.20.1"), "1.20.1");
        assert_eq!(get(&l, "renderDistance").as_deref(), Some("12"));
        assert!(get(&l, "useVbo").is_none());
        assert!(get(&l, "ao").is_none());
    }

    #[test]
    fn lwjgl_codes() {
        assert_eq!(lwjgl_code("key.keyboard.w"), Some(17));
        assert_eq!(lwjgl_code("key.keyboard.a"), Some(30));
        assert_eq!(lwjgl_code("key.keyboard.space"), Some(57));
        assert_eq!(lwjgl_code("key.keyboard.left.shift"), Some(42));
        assert_eq!(lwjgl_code("key.keyboard.1"), Some(2));
        assert_eq!(lwjgl_code("key.keyboard.f5"), Some(63));
        assert_eq!(lwjgl_code("key.mouse.4"), Some(-97));
    }

    #[test]
    fn merge_replaces_only_its_keys() {
        let existing = "version:3955\nfov:0.0\nkey_key.forward:key.keyboard.w\n";
        let merged = merge(
            existing,
            &[
                ("fov".into(), "0.5".into()),
                ("renderDistance".into(), "12".into()),
            ],
        );
        assert_eq!(
            merged,
            "version:3955\nfov:0.5\nkey_key.forward:key.keyboard.w\nrenderDistance:12\n"
        );
    }

    #[test]
    fn templates_stay_on_their_side_of_1_13() {
        assert!(same_keybind_format("1.20.1", "26.3"));
        assert!(same_keybind_format("1.8.9", "1.12.2"));
        assert!(!same_keybind_format("1.8.9", "1.21.1"));
    }
}
