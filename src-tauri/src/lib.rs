//! Tauri sidecar for Agent Command Center.
//!
//! Provides the native capabilities the web layer can't: OS-keychain secret
//! storage (`keychain`) and managed child processes for the coding agents
//! (`process`). All capabilities are exposed to the front end as Tauri commands.
mod commands;
use commands::keychain::{delete_secret, get_secret, set_secret};
use commands::process::{kill_process, run_process_blocking, send_stdin, spawn_process};
use commands::skills::{list_skills, read_skill, write_skill};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

/// Build and run the Tauri application.
///
/// Registers the SQL plugin, sets up the shared map of spawned child processes
/// as managed state, and wires up every command exposed to the front end.
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .manage(Arc::new(Mutex::new(HashMap::<String, std::process::Child>::new())))
        .invoke_handler(tauri::generate_handler![
            set_secret, get_secret, delete_secret,
            spawn_process, kill_process, send_stdin, run_process_blocking,
            list_skills, read_skill, write_skill,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
