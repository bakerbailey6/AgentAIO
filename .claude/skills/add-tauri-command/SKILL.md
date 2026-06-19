---
name: add-tauri-command
description: Use when exposing a new native/OS capability from the Rust Tauri sidecar to the front end in Agent Command Center — adding a #[command] callable via invoke() (filesystem, process, keychain-style, OS APIs). Covers the Rust command shape, the two-place registration in lib.rs, the TS invoke bridge, and the Windows MockRuntime test gotcha.
---

# Add a Tauri command

## Overview

Native capabilities the web layer can't do (OS keychain, child processes, filesystem) are Rust
`#[command]`s in `src-tauri/src/commands/`, reached from TS via `invoke()`. The pattern is small but
has two high-cost traps: **registration is in two places in `lib.rs`** (miss one → runtime "command
not found"), and on **this Windows host the Tauri `MockRuntime` test feature breaks `cargo test`
entirely** — so testable logic must be extracted into AppHandle-free free functions.

## When to use

- Exposing any new OS/native capability to the front end (`read_text_file`, `pick_folder`, a new
  process control, etc.).
- Symptoms: "call native code", "add an `invoke` command", "the browser can't do X, do it in Rust".

## Two traps to get right (these are why this skill exists)

1. **`map_err` error idiom.** Every command returns `Result<T, String>` and converts every error with
   `.map_err(|e| e.to_string())` — there is no custom error enum. A `Result<String, String>` body
   that returns a non-`String` error won't compile, so don't forget the conversion.
2. **Windows `MockRuntime` gotcha.** **Do NOT add `tauri = { features = ["test"] }` as a plain
   dev-dependency.** On this Windows MSVC toolchain a test binary linked with it fails to load
   (`STATUS_ENTRYPOINT_NOT_FOUND`, 0xc0000139), breaking the *whole* `cargo test` run. It's gated
   behind the opt-in `mock-runtime-tests` Cargo feature (already in `Cargo.toml`). Default `cargo test`
   runs only AppHandle-free unit tests; gate any `MockRuntime`/`AppHandle` test behind
   `#[cfg(feature = "mock-runtime-tests")]` and run the full set on Linux/CI with
   `cargo test --features mock-runtime-tests`.

## Recipe

1. **Pick or create a module** under `src-tauri/src/commands/`. New domain → new file (e.g.
   `commands/fs.rs`); otherwise extend `keychain.rs` / `process.rs`.
2. If a new file, **declare it** in `src-tauri/src/commands/mod.rs`: `pub mod fs;`.
3. **Write the command** (`pub fn`, sync, `#[command]` via `use tauri::command;`):
   ```rust
   /// Doc comment describing the command.
   #[command]
   pub fn read_text_file(path: String) -> Result<String, String> {
       std::fs::read_to_string(&path).map_err(|e| e.to_string())
   }
   ```
   - Return type `T` must be serde-serializable (`String`, `Option<String>`, `Vec<String>`, or a
     `#[derive(Serialize)]` struct).
   - If it needs the app/managed state, make it generic and take `app` first:
     `pub fn my_cmd<R: Runtime>(app: AppHandle<R>, …)`, then `app.state::<MyState>()`.
4. **If it needs new managed state**, register it in `src-tauri/src/lib.rs` `run()` with
   `.manage(Arc::new(Mutex::new(...)))` (mirror the existing `ProcessMap` `HashMap`).
5. **Register the command — TWO places in `src-tauri/src/lib.rs`:**
   - add `use commands::fs::read_text_file;` near the other `use commands::…` imports
   - add `read_text_file` to the `tauri::generate_handler![…]` list
   Missing either → `invoke()` fails at runtime with "command not found".
6. **(No capability edit.)** Custom `#[command]`s need **no** entry in
   `src-tauri/capabilities/default.json` — that file holds Tauri plugin/core permissions (this repo's
   `default.json` lists only `core:default`); add a line there only if you enable a plugin that
   requires one.
7. **Add the TS bridge.** Thin wrapper module (canonical: `src/lib/keychain.ts`):
   ```ts
   import { invoke } from '@tauri-apps/api/core'
   export async function readTextFile(path: string): Promise<string> {
     return invoke<string>('read_text_file', { path })
   }
   ```
   Pass args as a **camelCase** object — Tauri v2 maps camelCase JS keys to snake_case Rust params
   (`processId` → `process_id`); single-word names match verbatim. (Process-style commands are invoked
   inline in agent code rather than via a bridge module — see `src/lib/agents/claude-code-agent.ts`.)
   If the command emits events, `listen()` from `@tauri-apps/api/event`.
8. **Test** (see Testing). **Verify:** `cargo test` in `src-tauri/` (full cargo path on this host) and
   `npm test` for the TS bridge.

## Conventions

- All errors stringified via `.map_err(|e| e.to_string())`; commands are `pub fn` + `#[command]`.
- AppHandle-free core logic is extracted into free functions (`spawn_child`, `kill_in_map`, …) so it's
  unit-testable without a Tauri app.
- Modules use `//!` docs; commands use `///` docs. Resource handles use `uuid::Uuid::new_v4()`.
- When spawning children you MUST drain stdout/stderr on background threads or the pipe buffer fills
  and the child hangs.

## Common mistakes

| Mistake | Consequence |
|---|---|
| Registered in `generate_handler!` but not `use` (or vice-versa) | `invoke()` → runtime "command not found" |
| Added `tauri features=["test"]` as a dev-dep | `cargo test` binary won't load on Windows (0xc0000139) |
| Tested an `AppHandle` command ungated | Same — breaks the whole `cargo test` run on Windows |
| Added a capability entry for a custom command | Unnecessary; capabilities are for plugins only |
| snake_case args in the TS `invoke` call | Arg-name mismatch unless single-word |

## Testing

Two layers. **Rust:** unit-test AppHandle-free helpers in a `#[cfg(test)] mod tests` block at the
bottom of the command file (always-on) — see `src-tauri/src/commands/process.rs`. Gate any
`AppHandle`/`MockRuntime` test behind `#[cfg(feature = "mock-runtime-tests")]`. **TS:** `vi.mock`
`@tauri-apps/api/core` returning canned per-command values and exercise the bridge — template:
`src/lib/__tests__/keychain.test.ts`. Note: keychain Rust tests hit the real OS keychain and need a
session (use uuid-suffixed keys); they fail headless.
