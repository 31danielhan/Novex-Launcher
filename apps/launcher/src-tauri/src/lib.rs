mod platform;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![platform::system_info])
        .run(tauri::generate_context!())
        .expect("error while running Novex Launcher");
}
