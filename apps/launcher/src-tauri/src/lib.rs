pub mod auth;
pub mod content;
pub mod downloads;
pub mod error;
pub mod game;
pub mod instances;
pub mod java;
pub mod loaders;
pub mod platform;
pub mod settings;

use std::collections::HashMap;
use std::sync::atomic::AtomicBool;

use tauri::Manager;
use tokio::sync::{oneshot, Mutex};

pub struct AppState {
    pub paths: platform::Paths,
    pub http: reqwest::Client,
    pub accounts: Mutex<auth::store::AccountStore>,
    pub settings: Mutex<settings::Settings>,
    pub auth_cancel: AtomicBool,
    /// Running (or launching) instances; the sender stops the game.
    pub running: Mutex<HashMap<String, Option<oneshot::Sender<()>>>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let paths = platform::Paths::resolve(app.handle())?;
            std::fs::create_dir_all(&paths.root)?;
            app.manage(AppState {
                http: downloads::http_client(),
                accounts: Mutex::new(auth::store::AccountStore::load(&paths.root)),
                settings: Mutex::new(settings::Settings::load(&paths)),
                auth_cancel: AtomicBool::new(false),
                running: Mutex::new(HashMap::new()),
                paths,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            platform::system_info,
            platform::open_path,
            auth::accounts_list,
            auth::account_select,
            auth::account_remove,
            auth::account_add_offline,
            auth::auth_start,
            auth::auth_finish,
            auth::auth_cancel,
            game::version::versions_list,
            game::launch_instance,
            game::kill_instance,
            game::running_instances,
            instances::instances_list,
            instances::instance_create,
            instances::instance_update,
            instances::instance_clone,
            instances::instance_delete,
            loaders::loader_versions,
            instances::instance_folder,
            settings::settings_get,
            settings::settings_set,
            content::content_sources,
            content::content_search,
            content::content_versions,
            content::content_install,
            content::content_list,
            content::content_set_enabled,
            content::content_remove,
            content::modpack_install,
            content::modpack_import,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Novex Launcher");
}
