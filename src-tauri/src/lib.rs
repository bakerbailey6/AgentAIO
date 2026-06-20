//! Tauri sidecar for Agent Command Center.
//!
//! Provides the native capabilities the web layer can't: OS-keychain secret
//! storage (`keychain`) and managed child processes for the coding agents
//! (`process`). All capabilities are exposed to the front end as Tauri commands.
mod commands;
use commands::keychain::{delete_secret, get_secret, set_secret};
use commands::vault::{vault_execute, vault_open, vault_select, VaultState};
use commands::process::{kill_process, run_process_blocking, send_stdin, spawn_process};
use commands::skills::{list_skills, read_skill, write_skill};
use commands::fs::{fs_read_text, fs_write_text};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

/// Build and run the Tauri application.
///
/// Sets up the shared map of spawned child processes as managed state, and wires
/// up every command exposed to the front end. The app DB is opened directly
/// through the native `vault_*` (SQLCipher) commands — not a SQL plugin.
pub fn run() {
    tauri::Builder::default()
        .manage(Arc::new(Mutex::new(HashMap::<String, std::process::Child>::new())))
        .manage::<VaultState>(Arc::new(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            set_secret, get_secret, delete_secret,
            vault_open, vault_execute, vault_select,
            spawn_process, kill_process, send_stdin, run_process_blocking,
            list_skills, read_skill, write_skill,
            fs_read_text, fs_write_text,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
