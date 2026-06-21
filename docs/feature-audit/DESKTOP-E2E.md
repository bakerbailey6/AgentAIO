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

### Bugs found — and fixed this pass (see `user-stories.csv`)
- **US-089 — Claude Code agent was non-functional from the UI → FIXED & VERIFIED.** It used to throw
  `Error: Claude Code requires a project directory`. Fix: added `projectDirectory` to the agents
  schema/repo + Create/Edit panels + the `ChatPanel` session, and corrected the stale CLI flags
  (`--print --verbose --output-format stream-json --include-partial-messages`) and the `stream_event`
  text parsing. **Re-verified on the real binary:** a Claude Code agent with a project directory now
  returns a real response (`HELLO`) — no error (`/tmp/shot-claudecode-fixed.png`).
- **US-090 — Codex agent** shares the same `projectDirectory` plumbing fix, but can't be live-verified
  here (the `codex` CLI isn't installed).
- **US-088 — LLM tool-call loop.** `ChatPanel` no longer hardcodes an empty `permissionScope`; it now
  derives `allowedPaths` from the project directory and enables shell for coding agents. The full
  LLM-driven loop still can't be demonstrated live (the only available model, `claude-cli`, is
  text-only in this app's loop — a tool-capable API key is needed).

### Genuine environmental limits (after exhausting the authorized installs)
- **OpenAI / Google providers** — no API keys present (and harvesting the `claude` CLI token is
  disallowed), so no live round-trip. Unit-tested only.
- **Ollama** — installed and serving; `/api/tags` model-listing works (the provider's `listModels`
  path verified live). **Local inference is unavailable**: the bundled `llama-server` runner
  **SIGSEGVs on model warm-up** for every model (3b, 0.5b) and config (flash-attn off, avx2) — a
  llama.cpp/virtualized-CPU incompatibility, not an app defect.
- **Codex** — CLI installed (0.141.0) and spawns in the project dir, but is **"Not logged in"**
  (needs OpenAI/ChatGPT auth not present), so no live response.
- **LLM-driven tool-call loop** — needs a working tool-capable model; `claude-cli` is text-only in
  this loop and the local Ollama path (which would have provided tools) can't run inference here.
  `ChatPanel` now derives a real `permissionScope`, so the wiring is correct and ready.
