use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{command, AppHandle, Emitter, Manager};
use uuid::Uuid;

type ProcessMap = Arc<Mutex<HashMap<String, Child>>>;

fn get_processes(app: &AppHandle) -> ProcessMap {
    app.state::<ProcessMap>().inner().clone()
}

#[command]
pub fn spawn_process(
    app: AppHandle,
    cmd: String,
    args: Vec<String>,
    cwd: Option<String>,
) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let mut builder = Command::new(&cmd);
    builder.args(&args).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
    if let Some(dir) = cwd {
        builder.current_dir(dir);
    }
    let mut child = builder.spawn().map_err(|e| e.to_string())?;

    // Spawn background threads to consume stdout/stderr and emit Tauri events.
    // Without consuming these pipes the OS pipe buffer will fill and deadlock the child.
    if let Some(stdout) = child.stdout.take() {
        let app_handle = app.clone();
        let id_clone = id.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                if let Ok(line) = line {
                    let _ = app_handle.emit(&format!("process://stdout/{}", id_clone), line);
                }
            }
        });
    }
    if let Some(stderr) = child.stderr.take() {
        let app_handle = app.clone();
        let id_clone = id.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                if let Ok(line) = line {
                    let _ = app_handle.emit(&format!("process://stderr/{}", id_clone), line);
                }
            }
        });
    }

    get_processes(&app)
        .lock()
        .map_err(|e| e.to_string())?
        .insert(id.clone(), child);
    Ok(id)
}

#[command]
pub fn kill_process(app: AppHandle, process_id: String) -> Result<(), String> {
    let processes = get_processes(&app);
    let mut map = processes.lock().map_err(|e| e.to_string())?;
    if let Some(mut child) = map.remove(&process_id) {
        child.kill().map_err(|e| e.to_string())?;
    } else {
        return Err(format!("Process not found: {}", process_id));
    }
    Ok(())
}

#[command]
pub fn send_stdin(app: AppHandle, process_id: String, data: String) -> Result<(), String> {
    let processes = get_processes(&app);
    let mut map = processes.lock().map_err(|e| e.to_string())?;
    if let Some(child) = map.get_mut(&process_id) {
        if let Some(stdin) = child.stdin.as_mut() {
            stdin.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
        } else {
            return Err(format!("No stdin for process: {}", process_id));
        }
    } else {
        return Err(format!("Process not found: {}", process_id));
    }
    Ok(())
}
