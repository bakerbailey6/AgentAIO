# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims to follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- **Documentation overhaul.** Rewrote `README.md` (badges, table of contents, Mermaid architecture /
  event-flow / vault-unlock diagrams, accurate provider and tool coverage). Added `CONTRIBUTING.md`,
  `SECURITY.md`, and this changelog. De-staled the progress ledger
  (`docs/superpowers/plans/PROGRESS.md`) to reflect shipped SQLCipher, Google Gemini, and the tool
  registry.

## [0.1.0] — Phase 1 (Agent Shell)

Feature-complete agent shell. Extensively unit-tested; the integrated desktop binary has not yet been
exercised end-to-end on a real host (see `docs/superpowers/plans/PROGRESS.md`).

### Added
- **Spatial canvas** — React Flow canvas with draggable agent cards, groups, edges, live status and
  action feeds, and persisted positions/viewport.
- **Agent runtimes** — LLM Agent (in-process, Vercel AI SDK `streamText()`), Claude Code, and Codex
  (managed CLI subprocesses), registered in `AGENT_REGISTRY`.
- **LLM router + providers** — Anthropic, OpenAI, and Ollama, resolved by `LLMRouter` through
  `PROVIDER_REGISTRY`.
- **Google Gemini provider** — Gemini 2.5 Pro / 2.5 Flash / 2.0 Flash (1M context).
- **Subscription sign-in** — `claude-cli` / `codex-cli` providers and a hand-written
  `CliLanguageModel` that shells out via the sidecar, letting Claude Pro/Max and ChatGPT Plus/Pro
  plans be used in chat cards without an API key. Adds the `authType` provider field and the Rust
  `run_process_blocking` command.
- **MCP registry** — connect Model Context Protocol servers over `stdio` / `sse`; built-in catalog in
  the store.
- **Built-in tool tier** — `ToolDefinition` registry (`TOOL_REGISTRY`) with web search, file
  read/write, shell, headless browser, and image generation, each gated by a permission scope.
- **Approval gates + audit log** — inline Approve / Deny prompts for sensitive actions, recorded in an
  append-only `audit_log` table.
- **Encrypted storage (SQLCipher).** The app database is keyed with a keychain-stored passphrase via
  the native `vault_open` / `vault_execute` / `vault_select` commands; `VaultGate` gates the app on
  unlock. (PR #12.)
- **OS keychain integration** — API keys and the vault passphrase stored via the Rust keychain
  commands; the database holds only references.
- **App shell** — Sidebar, TopBar, StatusBar, settings (providers / models / subscription sign-in),
  and the Tools/MCP/Skills store panel.

### Fixed
- **Desktop bundling.** Added `output: 'export'` to `next.config.ts` so `next build` emits the `out/`
  directory that `tauri.conf.json`'s `frontendDist: ../out` bundles (previously the desktop app
  shipped no frontend).
- **Agent-type resolution.** `resolveAgentRuntimeType()` maps persisted `coding-agent` / `custom`
  types to the `claude-code` / `codex` runtime keys, so coding agents actually run.

[Unreleased]: https://github.com/bakerbailey6/AgentAIO/compare/main...HEAD
[0.1.0]: https://github.com/bakerbailey6/AgentAIO/releases/tag/v0.1.0
