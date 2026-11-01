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
pub mod update;

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
    /// The downloaded interface in use, if any.
    pub ui: update::ui::UiState,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let ui = update::ui::UiState::default();
    let mut context = tauri::generate_context!();
    // Serve a verified interface update in place of the built-in files, when there is one.
    let embedded = context.set_assets(Box::new(update::ui::NoAssets));
    context.set_assets(Box::new(update::ui::BundleAssets::new(
        embedded,
        ui.clone(),
    )));

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(update::Pending::default())
        .setup(move |app| {
            let paths = platform::Paths::resolve(app.handle())?;
            std::fs::create_dir_all(&paths.root)?;
            update::ui::load_stored(app.handle(), &paths, &ui);
            // The window is created here rather than from the config so the interface
            // above is chosen before the page loads.
            let window = app
                .config()
                .app
                .windows
                .iter()
                .find(|w| w.label == "main")
                .cloned()
                .expect("main window in tauri.conf.json");
            tauri::WebviewWindowBuilder::from_config(app.handle(), &window)?.build()?;
            app.manage(AppState {
                ui: ui.clone(),
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
            update::update_info,
            update::app_update_check,
            update::app_update_install,
            update::ui::ui_update_check,
            update::ui::ui_update_install,
            update::ui::ui_boot_ok,
            update::ui::ui_reset,
        ])
        .run(context)
        .expect("error while running Novex Launcher");
}
