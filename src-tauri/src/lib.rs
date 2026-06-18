// src-tauri/src/lib.rs
mod commands;
use commands::keychain::{delete_secret, get_secret, set_secret};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![set_secret, get_secret, delete_secret])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
