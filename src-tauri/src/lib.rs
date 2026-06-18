// src-tauri/src/lib.rs
mod commands;
use commands::keychain::{delete_secret, get_secret, set_secret};
use commands::process::{kill_process, send_stdin, spawn_process};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .manage(Arc::new(Mutex::new(HashMap::<String, std::process::Child>::new())))
        .invoke_handler(tauri::generate_handler![
            set_secret, get_secret, delete_secret,
            spawn_process, kill_process, send_stdin,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
