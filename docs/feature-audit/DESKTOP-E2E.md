# Desktop End-to-End Testing — Real Tauri Binary

This documents the **real desktop** end-to-end test harness used to verify Agent Command Center
against the actual Tauri binary (not web mode, not mocks), including **live Claude inference**.

## How it runs

The app is a Tauri 2 desktop app. We drive the **real compiled binary** with
[`tauri-driver`](https://tauri.app/develop/tests/webdriver/) + `WebKitWebDriver`, controlled by
WebdriverIO, inside a headless display with a real D-Bus session and OS keyring:

```
xvfb-run -a -s "-screen 0 1280x900x24" \
  dbus-run-session -- bash drive.sh <test>.mjs
```

`drive.sh` unlocks a `gnome-keyring` Secret Service (so the SQLCipher vault passphrase can be
stored/retrieved exactly as on a user's machine), then launches `tauri-driver --native-driver
/usr/bin/WebKitWebDriver` and runs the WebdriverIO script against `src-tauri/target/debug/app`.

**Prerequisites** (installed for this run): `libgtk-3-dev`, `libwebkit2gtk-4.1-dev`,
`webkit2gtk-driver` (WebKitWebDriver), `dbus-x11`, `gnome-keyring`, `xvfb`, `imagemagick`,
`tauri-driver` (`cargo install`), `webdriverio` (devDependency). The debug binary loads the Next
dev server (`npm run dev` on :3000), which is how `tauri dev` works — full native capabilities active.

The model used for live inference is the installed, authenticated **`claude` CLI** (2.1.185),
exercised through the app's own `claude-cli` provider. No API keys are harvested.

## Scripts (`e2e-desktop/`)

| Script | Covers |
|---|---|
| `full-suite.mjs` | Shell+vault unlock · nav (Store/Workflows/Settings) · add a real Claude model · model persistence across reload · create LLM agent · agent persistence across reload · **real Claude chat round-trip (PONG)** |
| `feature2.mjs` | Create agent · **edit/rename agent** · **Store: install a tool + assign to agent** · tool persistence across reload · **workflow create + save + persist** |
| `codingagent.mjs` | Creates a Claude Code agent and proves the project-directory failure (bug evidence) |

## Results (this run)

**All green except the documented bugs.** Evidence screenshots in `/tmp/shot-*.png` (chat PONG, shell, store, settings, model-added, agent-created).

- ✅ Desktop binary boots headless; **SQLCipher vault unlocks** via the real OS Secret Service; `acc.db` on disk is **not** a plaintext SQLite file (encrypted at rest).
- ✅ Native command layer: `cargo test` **32/32**; `cargo test --features mock-runtime-tests` **36/36** (the `#[command]` handlers — spawn/kill/stdin — run on Linux).
- ✅ Navigation, Settings, **add real Claude model**, create/edit agent, **persistence across reload** (encrypted DB), Store tool install+assign, workflow create+persist.
- ✅ **Real LLM agent functionality**: `claude-cli` provider → `CliLanguageModel` → Tauri process sidecar → real `claude` CLI → streamed **"PONG"** into the chat UI.

### Confirmed bugs (see `user-stories.csv`)
- **US-089 / US-090 — Claude Code & Codex agents are non-functional from the UI.** Chatting yields
  `Error: Claude Code requires a project directory`. There is no `projectDirectory` field on
  `AgentRow`, no input in Create/Edit, and `ChatPanel` builds the session without one. Additionally
  the runtime's CLI flags are stale (`claude --print --output-format stream-json` now requires
  `--verbose`).
- **US-088 — the LLM tool-call loop can't be exercised end-to-end** here: `ChatPanel` hardcodes
  `permissionScope { allowedPaths: [], shellEnabled: false }`, so file/shell tools are always denied,
  and the only live model available (`claude-cli`) is text-only in this app's loop (emits no
  tool-call parts). A tool-capable API key + per-agent permission wiring are needed.

### Genuine environmental limits (no compromise possible without resources)
- **OpenAI / Google / Ollama / Codex** providers cannot be live-tested: no API keys and no
  `ollama`/`codex` binaries are present in this environment. Their provider code is unit-tested only.
