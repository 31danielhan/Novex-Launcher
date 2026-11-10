//! A light blur behind glass themes. macOS's blur materials paint a nearly solid grey layer, so the
//! blur view is added and then faded: the desktop shows through, softened, under the window's tint.

/// How strongly the blur view shows: 0 is a clear window, 1 the full grey material.
const STRENGTH: f64 = 0.5;

#[tauri::command]
pub fn window_glass(window: tauri::WebviewWindow, on: bool) -> Result<(), String> {
    use tauri::window::{Effect, EffectState, EffectsBuilder};
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
        window
            .run_on_main_thread(move || unsafe { fade(ns as *mut objc2::runtime::AnyObject) })
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(target_os = "macos")]
unsafe fn fade(ns_window: *mut objc2::runtime::AnyObject) {
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
                let _: () = msg_send![view, setAlphaValue: STRENGTH];
            }
        }
    }
}
