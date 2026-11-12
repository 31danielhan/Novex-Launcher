//! A light blur behind glass themes. macOS's blur materials paint a nearly solid grey layer, so the
//! blur view is added and then faded: the desktop shows through, softened, under the window's tint.

/// How strongly the blur view shows when none is given: 0 is a clear window, 1 the full grey
/// material.
#[cfg(target_os = "macos")]
const DEFAULT_STRENGTH: f64 = 0.5;

/// Turns the glass on or off. `strength` (0 to 1) sets how much the desktop is blurred, and `dark`
/// picks a dark blur for dark mode instead of the light one.
#[tauri::command]
pub fn window_glass(
    window: tauri::WebviewWindow,
    on: bool,
    strength: Option<f64>,
    dark: Option<bool>,
) -> Result<(), String> {
    // The blur material follows the window's appearance, so match it to the launcher's mode.
    if let Some(dark) = dark {
        let theme = if dark {
            tauri::Theme::Dark
        } else {
            tauri::Theme::Light
        };
        window.set_theme(Some(theme)).map_err(|e| e.to_string())?;
    }
    use tauri::window::{Effect, EffectState, EffectsBuilder};
    #[cfg(not(target_os = "macos"))]
    let _ = strength;
    if !on {
        return window.set_effects(None).map_err(|e| e.to_string());
    }
    window
        .set_effects(
            EffectsBuilder::new()
                .effect(Effect::UnderWindowBackground)
                .state(EffectState::Active)
                .build(),
        )
        .map_err(|e| e.to_string())?;
    #[cfg(target_os = "macos")]
    {
        let ns = window.ns_window().map_err(|e| e.to_string())? as usize;
        let strength = strength.unwrap_or(DEFAULT_STRENGTH).clamp(0.0, 1.0);
        window
            .run_on_main_thread(move || unsafe {
                fade(ns as *mut objc2::runtime::AnyObject, strength)
            })
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(target_os = "macos")]
unsafe fn fade(ns_window: *mut objc2::runtime::AnyObject, strength: f64) {
    use objc2::msg_send;
    use objc2::runtime::{AnyClass, AnyObject, Bool};
    let Some(class) = AnyClass::get(c"NSVisualEffectView") else {
        return;
    };
    let content: *mut AnyObject = msg_send![ns_window, contentView];
    if content.is_null() {
        return;
    }
    // The blur view sits under the web view, in the content view or its superview.
    for host in [content, msg_send![content, superview]] {
        let host: *mut AnyObject = host;
        if host.is_null() {
            continue;
        }
        let views: *mut AnyObject = msg_send![host, subviews];
        let count: usize = msg_send![views, count];
        for i in 0..count {
            let view: *mut AnyObject = msg_send![views, objectAtIndex: i];
            let is: Bool = msg_send![view, isKindOfClass: class];
            if is.as_bool() {
                let _: () = msg_send![view, setAlphaValue: strength];
            }
        }
    }
}
