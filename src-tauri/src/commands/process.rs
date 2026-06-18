use std::collections::HashMap;
use std::io::Write;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{command, AppHandle, Manager};
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
    let child = builder.spawn().map_err(|e| e.to_string())?;
    get_processes(&app).lock().unwrap().insert(id.clone(), child);
    Ok(id)
}

#[command]
pub fn kill_process(app: AppHandle, process_id: String) -> Result<(), String> {
    let processes = get_processes(&app);
    let mut map = processes.lock().unwrap();
    if let Some(mut child) = map.remove(&process_id) {
        child.kill().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[command]
pub fn send_stdin(app: AppHandle, process_id: String, data: String) -> Result<(), String> {
    let processes = get_processes(&app);
    let mut map = processes.lock().unwrap();
    if let Some(child) = map.get_mut(&process_id) {
        if let Some(stdin) = child.stdin.as_mut() {
            stdin.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}
