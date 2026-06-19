use serde::Serialize;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{command, AppHandle, Emitter, Manager, Runtime};
use uuid::Uuid;

type ProcessMap = Arc<Mutex<HashMap<String, Child>>>;

fn get_processes<R: Runtime>(app: &AppHandle<R>) -> ProcessMap {
    app.state::<ProcessMap>().inner().clone()
}

/// Build and spawn the child process with all three stdio pipes attached.
///
/// Extracted from `spawn_process` so the command-building + spawn behavior can
/// be unit-tested without a Tauri `AppHandle` (the event emission is the only
/// part that genuinely needs the app handle).
fn spawn_child(cmd: &str, args: &[String], cwd: Option<&str>) -> Result<Child, String> {
    let mut builder = Command::new(cmd);
    builder.args(args).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
    if let Some(dir) = cwd {
        builder.current_dir(dir);
    }
    builder.spawn().map_err(|e| e.to_string())
}

/// Remove a child from the map by id and kill it.
///
/// Returns `Err` if no process with that id is tracked. Extracted so the
/// lookup/kill behavior is testable against a plain `ProcessMap`.
fn kill_in_map(processes: &ProcessMap, process_id: &str) -> Result<(), String> {
    let mut map = processes.lock().map_err(|e| e.to_string())?;
    if let Some(mut child) = map.remove(process_id) {
        child.kill().map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err(format!("Process not found: {}", process_id))
    }
}

/// Write bytes to a tracked child's stdin.
///
/// Returns `Err` if the id is unknown or the child has no stdin pipe.
fn write_stdin_in_map(processes: &ProcessMap, process_id: &str, data: &str) -> Result<(), String> {
    let mut map = processes.lock().map_err(|e| e.to_string())?;
    if let Some(child) = map.get_mut(process_id) {
        if let Some(stdin) = child.stdin.as_mut() {
            stdin.write_all(data.as_bytes()).map_err(|e| e.to_string())
        } else {
            Err(format!("No stdin for process: {}", process_id))
        }
    } else {
        Err(format!("Process not found: {}", process_id))
    }
}

/// Captured result of a process run to completion.
#[derive(Serialize)]
pub struct ProcOutput {
    /// Exit code, or `None` if the process was killed by a signal.
    pub code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
}

/// Run a command to completion and capture its exit code + output.
///
/// `AppHandle`-free (unlike the streaming `spawn_process`) so the blocking
/// behavior is unit-testable without a Tauri runtime. Returns `Err` only when
/// the binary can't be spawned at all (e.g. not on PATH); a non-zero exit is a
/// *successful* run reported with `code != Some(0)`. Used for one-shot CLI
/// status probes (e.g. `codex login status`, `claude --version`) where the
/// front end needs the exit code that `spawn_process` never surfaces.
fn run_blocking(cmd: &str, args: &[String], cwd: Option<&str>) -> Result<ProcOutput, String> {
    let mut builder = Command::new(cmd);
    builder.args(args);
    if let Some(dir) = cwd {
        builder.current_dir(dir);
    }
    let output = builder.output().map_err(|e| e.to_string())?;
    Ok(ProcOutput {
        code: output.status.code(),
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
    })
}

#[command]
pub fn run_process_blocking(
    cmd: String,
    args: Vec<String>,
    cwd: Option<String>,
) -> Result<ProcOutput, String> {
    run_blocking(&cmd, &args, cwd.as_deref())
}

#[command]
pub fn spawn_process<R: Runtime>(
    app: AppHandle<R>,
    cmd: String,
    args: Vec<String>,
    cwd: Option<String>,
) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let mut child = spawn_child(&cmd, &args, cwd.as_deref())?;

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
pub fn kill_process<R: Runtime>(app: AppHandle<R>, process_id: String) -> Result<(), String> {
    kill_in_map(&get_processes(&app), &process_id)
}

#[command]
pub fn send_stdin<R: Runtime>(app: AppHandle<R>, process_id: String, data: String) -> Result<(), String> {
    write_stdin_in_map(&get_processes(&app), &process_id, &data)
}

// Two layers of coverage:
//  1. The `AppHandle`-free core (`spawn_child`, `kill_in_map`,
//     `write_stdin_in_map`) tested against a plain `ProcessMap`. Always on.
//  2. The full `#[command]` functions (`spawn_process`, `kill_process`,
//     `send_stdin`) driven through a headless `tauri::test` MockRuntime app,
//     which exercises the `AppHandle` path — state registration and lookup via
//     `get_processes` — that the pure-logic tests can't reach. The commands are
//     generic over `Runtime`, so the MockRuntime handle drives the real bodies.
//     Gated behind the `mock-runtime-tests` feature: on this Windows toolchain a
//     test binary linked with tauri's `test` feature fails to *load*
//     (STATUS_ENTRYPOINT_NOT_FOUND), so it is off by default. Run on Linux/CI
//     with `cargo test --features mock-runtime-tests`.
// All of these spawn real OS child processes, so they must run on a host machine.
#[cfg(test)]
mod tests {
    use super::*;

    fn empty_map() -> ProcessMap {
        Arc::new(Mutex::new(HashMap::new()))
    }

    /// Build a headless mock Tauri app with the `ProcessMap` state registered,
    /// mirroring `lib.rs`'s `.manage(...)`, so the commands resolve their state.
    #[cfg(feature = "mock-runtime-tests")]
    fn mock_app() -> tauri::App<tauri::test::MockRuntime> {
        use tauri::test::{mock_builder, mock_context, noop_assets};
        mock_builder()
            .manage::<ProcessMap>(empty_map())
            .build(mock_context(noop_assets()))
            .expect("building the mock app should succeed")
    }

    /// A process that reads stdin and stays alive until its stdin closes,
    /// so stdin writes and explicit kills can be tested deterministically.
    fn stdin_reader() -> (String, Vec<String>) {
        if cfg!(windows) {
            // `cmd` with no `/C` runs interactively and reads from stdin.
            ("cmd".to_string(), vec![])
        } else {
            ("cat".to_string(), vec![])
        }
    }

    /// A process that prints one line and exits immediately.
    fn quick_echo() -> (String, Vec<String>) {
        if cfg!(windows) {
            ("cmd".to_string(), vec!["/C".to_string(), "echo".to_string(), "hi".to_string()])
        } else {
            ("sh".to_string(), vec!["-c".to_string(), "echo hi".to_string()])
        }
    }

    /// A process that exits with a non-zero status, for exit-code assertions.
    fn nonzero_exit() -> (String, Vec<String>) {
        if cfg!(windows) {
            ("cmd".to_string(), vec!["/C".to_string(), "exit".to_string(), "3".to_string()])
        } else {
            ("sh".to_string(), vec!["-c".to_string(), "exit 3".to_string()])
        }
    }

    #[test]
    fn run_blocking_captures_stdout_and_zero_exit() {
        let (cmd, args) = quick_echo();
        let out = run_blocking(&cmd, &args, None).expect("run should succeed");
        assert_eq!(out.code, Some(0), "echo should exit 0");
        assert!(
            out.stdout.contains("hi"),
            "stdout should contain the echoed text, got {:?}",
            out.stdout
        );
    }

    #[test]
    fn run_blocking_errors_on_missing_binary() {
        let res = run_blocking("acc-no-such-binary-xyzzy", &[], None);
        assert!(res.is_err(), "spawning a non-existent binary should return Err");
    }

    #[test]
    fn run_blocking_reports_nonzero_exit_as_ok() {
        let (cmd, args) = nonzero_exit();
        let out = run_blocking(&cmd, &args, None)
            .expect("a non-zero exit is still a successful run, not an Err");
        assert_eq!(out.code, Some(3), "exit code should be surfaced, not turned into Err");
    }

    #[test]
    fn spawn_child_succeeds_and_pipes_are_attached() {
        let (cmd, args) = quick_echo();
        let mut child = spawn_child(&cmd, &args, None).expect("spawn should succeed");
        // All three pipes were requested via Stdio::piped().
        assert!(child.stdin.is_some(), "stdin pipe should be attached");
        assert!(child.stdout.is_some(), "stdout pipe should be attached");
        assert!(child.stderr.is_some(), "stderr pipe should be attached");
        let _ = child.wait();
    }

    #[test]
    fn spawn_child_errors_on_missing_binary() {
        let res = spawn_child("acc-no-such-binary-xyzzy", &[], None);
        assert!(res.is_err(), "spawning a non-existent binary should return Err");
    }

    #[test]
    fn spawn_child_honors_cwd() {
        // A bogus cwd makes the spawn fail, proving cwd is applied to the builder.
        let (cmd, args) = quick_echo();
        let res = spawn_child(&cmd, &args, Some("acc-no-such-directory-xyzzy"));
        assert!(res.is_err(), "spawning in a non-existent cwd should return Err");
    }

    #[test]
    fn kill_in_map_kills_tracked_child_and_removes_it() {
        let map = empty_map();
        let (cmd, args) = stdin_reader();
        let child = spawn_child(&cmd, &args, None).expect("spawn should succeed");
        let id = "proc-1".to_string();
        map.lock().unwrap().insert(id.clone(), child);

        kill_in_map(&map, &id).expect("killing a tracked child should succeed");
        assert!(
            !map.lock().unwrap().contains_key(&id),
            "killed child should be removed from the map"
        );
    }

    #[test]
    fn kill_in_map_errors_on_unknown_id() {
        let map = empty_map();
        let res = kill_in_map(&map, "unknown-id");
        assert!(res.is_err(), "killing an unknown id should return Err");
    }

    #[test]
    fn write_stdin_in_map_writes_to_tracked_child() {
        let map = empty_map();
        let (cmd, args) = stdin_reader();
        let child = spawn_child(&cmd, &args, None).expect("spawn should succeed");
        let id = "proc-1".to_string();
        map.lock().unwrap().insert(id.clone(), child);

        write_stdin_in_map(&map, &id, "hello\n").expect("writing to stdin should succeed");

        // Clean up the still-running child.
        kill_in_map(&map, &id).expect("cleanup kill should succeed");
    }

    #[test]
    fn write_stdin_in_map_errors_on_unknown_id() {
        let map = empty_map();
        let res = write_stdin_in_map(&map, "unknown-id", "data");
        assert!(res.is_err(), "writing stdin to an unknown id should return Err");
    }

    // --- command-level tests via the MockRuntime AppHandle (opt-in feature) ---

    #[cfg(feature = "mock-runtime-tests")]
    #[test]
    fn spawn_process_command_returns_an_id() {
        let app = mock_app();
        let (cmd, args) = quick_echo();
        let id = spawn_process(app.handle().clone(), cmd, args, None)
            .expect("spawn_process should return Ok(id)");
        assert!(!id.is_empty(), "returned process id should be non-empty");
    }

    #[cfg(feature = "mock-runtime-tests")]
    #[test]
    fn spawn_then_kill_via_commands_round_trips() {
        let app = mock_app();
        let (cmd, args) = stdin_reader();
        let id = spawn_process(app.handle().clone(), cmd, args, None)
            .expect("spawn_process should succeed");
        // The child is tracked in the app-managed ProcessMap; kill_process must
        // find it via get_processes(&app) and remove it.
        kill_process(app.handle().clone(), id).expect("kill_process should succeed");
    }

    #[cfg(feature = "mock-runtime-tests")]
    #[test]
    fn kill_process_command_errors_on_unknown_id() {
        let app = mock_app();
        let res = kill_process(app.handle().clone(), "unknown-id".to_string());
        assert!(res.is_err(), "killing an unknown id should return Err");
    }

    #[cfg(feature = "mock-runtime-tests")]
    #[test]
    fn send_stdin_command_errors_on_unknown_id() {
        let app = mock_app();
        let res = send_stdin(app.handle().clone(), "unknown-id".to_string(), "data".to_string());
        assert!(res.is_err(), "sending stdin to an unknown id should return Err");
    }
}
