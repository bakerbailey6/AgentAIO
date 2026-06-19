# Agent Command Center — Progress Ledger

> **This file is the canonical source of truth for project status.** It is the first
> thing a new Claude Code session (or human) should read to learn *where we are* and
> *what's next*. The per-phase plan files (`2026-06-18-acc-phase1*.md`) describe *how*
> each task was built; their `- [ ]` checkboxes are **not** maintained — trust this file
> for completion status, not them.
>
> **How to maintain this file (read before editing):**
> - Update the *Snapshot* block whenever the verified baseline changes (test count, date).
> - Move items between **Done / In progress / Next / Backlog** as work lands. Never mark
>   something Done without a verification command and its observed output.
> - When you finish a unit of work, add a one-line entry to the **Changelog** at the bottom
>   with the date and the commit/PR.
> - Keep it short. This is a ledger, not a spec. Link out to specs/plans for detail.

---

## Snapshot

| | |
|---|---|
| **Phase** | Phase 1 (Agent Shell) — **feature-complete, not yet hardened** |
| **Verified baseline** | `npx vitest run` → **338 passing · 64 files** (observed 2026-06-19). `npx tsc --noEmit` → **clean (exit 0)**. Note: running the suite locally requires `@ai-sdk/google` present in `node_modules` — it's a declared dependency but was absent from the local install (the old "1 failing" baseline was masking this). |
| **TypeScript** | Product code clean; `npx tsc --noEmit` exits 0. (Fixed: `GoogleProvider` was missing the required `authType` field — a build-breaker surfaced once `@ai-sdk/google` resolves.) |
| **Desktop app run** | ⚠️ **Never verified end-to-end.** `npm run tauri:dev` has not been run on a real host. The LLM-agent no-response fix (below) needs a real desktop round-trip to confirm. |
| **Rust tests** | ⚠️ Blocked on this Windows host — see Known Risks. |
| **Design spec** | [agent-command-center-design.md](../specs/2026-06-18-agent-command-center-design.md) |

---

## Done — Phase 1 (Agent Shell)

All 15 tasks across the three Phase-1 plans are implemented and unit-tested.

**Phase 1A — Foundation** ([plan](2026-06-18-acc-phase1a-foundation.md))
- ✅ Task 1 — Tauri 2.0 + Next.js project scaffold *(note: Next.js is 16.x, not 15 — see report)*
- ✅ Task 2 — Core extensibility interfaces (`src/lib/interfaces/`)
- ✅ Task 3 — Typed event bus (`src/lib/event-bus.ts`)
- ✅ Task 4 — OS Keychain integration (`src-tauri/src/commands/keychain.rs`, `src/lib/keychain.ts`)
- ✅ Task 5 — SQLite storage layer + repositories (`src/lib/storage/`)

**Phase 1B — LLM Layer + Agents** ([plan](2026-06-18-acc-phase1b-llm-agents.md))
- ✅ Task 6 — Tauri process-management commands (`src-tauri/src/commands/process.rs`)
- ✅ Task 7 — LLM providers + router — **Anthropic, OpenAI, Ollama** (`src/lib/llm/`)
- ✅ Task 8 — MCP registry (`src/lib/mcp/registry.ts`)
- ✅ Task 9 — LLM agent runtime (`src/lib/agents/llm-agent.ts`)
- ✅ Task 10 — Claude Code & Codex agent runtimes (`src/lib/agents/`)

**Phase 1C — Canvas + UI** ([plan](2026-06-18-acc-phase1c-canvas-ui.md))
- ✅ Task 11 — App shell: Sidebar, TopBar, StatusBar (`src/components/layout/`)
- ✅ Task 12 — Live status hooks (`src/hooks/`)
- ✅ Task 13 — Agent card components (`src/components/canvas/`)
- ✅ Task 14 — Spatial canvas via React Flow (`src/components/canvas/AgentCanvas.tsx`)
- ✅ Task 15 — Store panel — **MCP catalog only** (`src/components/store/`, `src/lib/store/catalog.ts`)

### Post-Phase-1 additions
- ✅ **SQLCipher encryption at rest** (spec §9.2, PR #12). The app DB is keyed with a keychain-stored
  256-bit passphrase (`vault-passphrase`) via native `vault_open`/`vault_execute`/`vault_select`
  (`src-tauri/src/commands/vault.rs`), running `PRAGMA key` before migrations. `VaultGate`
  (`src/components/vault/VaultGate.tsx`) gates the desktop app on unlock; web mode renders the
  degraded shell directly. The app DB no longer uses `@tauri-apps/plugin-sql`.
- ✅ **Google Gemini provider** (spec §7). `GoogleProvider` registered in `PROVIDER_REGISTRY`
  (`src/lib/llm/providers/google.ts`) — Gemini 2.5 Pro / 2.5 Flash / 2.0 Flash, 1M context. The
  "implement one interface, register it" extensibility smoke test. ⚠️ The exhaustive provider-keys
  test was not updated alongside it — see the Snapshot failure note.
- ✅ **Built-in tool tier** (spec §8.2). `ToolDefinition` registry (`TOOL_REGISTRY`,
  `src/lib/tools/registry.ts`) with six built-in tools (`src/lib/tools/built-in/`): web_search,
  file_read, file_write, shell, browser, image_generation — each guarded by `PermissionScope`. *Note:*
  the registry + tools exist and are unit-tested, but the Phase-2 agent tool-call loop that resolves
  and invokes them at runtime is not yet wired.
- ✅ **Subscription "login" via official CLIs** — use Claude Pro/Max & ChatGPT Plus/Pro models in ordinary chat cards without an API key, routed through the `claude`/`codex` CLIs. New `claude-cli`/`codex-cli` providers build a `CliLanguageModel` (a hand-written `LanguageModelV2`) that shells out via the sidecar, so they flow through the existing router + LLM chat runtime unchanged. Adds `authType` on the provider contract, `isTauri()`, the Rust `run_process_blocking` command, and a "Subscription Sign-in" section in Settings. ⚠️ **Desktop-only and not yet exercised on a real `tauri:dev` run** — the per-CLI JSON line shapes and login flow are best-effort (see Known Risks). Google has no compliant subscription path (Anthropic OAuth is banned, Google's personal tier sunset) so it stays API-key only. *Follow-up:* the existing Claude Code / Codex coding-agent CLI flags are outdated (`codex --approval-mode suggest --quiet`, claude without `--include-partial-messages`) and were intentionally left untouched here — modernize them once the CLIs can be exercised live.

---

## Next — recommended order

These are the gaps between the shipped Phase 1 and the design spec, plus the work the spec
labels Phase 2/3. Roughly ordered by leverage. **Brainstorm scope before starting any of
these** (`superpowers:brainstorming`), then write/execute a plan.

A phased plan covering the remaining work is written up at
`C:\Users\chris\.claude\plans\i-noticed-that-when-harmonic-pearl.md` (fix no-response bug →
attach-UI → runtime tool-call loop → built-in tool backends → MCP native bridge).

### A. Harden Phase 1 (close the gap to "actually shippable")
1. **Verify the desktop app actually runs.** Run `npm run tauri:dev` and confirm the vault unlock,
   canvas, agent creation, and an LLM round-trip work in the real Tauri window. This is the single
   biggest unknown — everything is unit-tested but the integrated desktop binary has never been
   launched. See [Known Risks](#known-risks). **The no-response fix (Changelog 2026-06-19) needs this.**
2. ✅ **Stale provider-keys test fixed** (`index.test.ts` now lists `'google'`) and `GoogleProvider.authType`
   added — suite is fully green and `tsc --noEmit` is clean.
3. **Attach tools/MCPs/skills to agents (Phase 2 of the plan).** Data columns (`tool_ids`/`mcp_ids`)
   and the Store assign UI exist for tools/skills; **MCP assignment UI is missing**, there is no
   agent-centric edit panel, and `AgentRepository` lacks `updateMcpIds`. See plan Phase 2.
4. **Wire the tool-call loop (Phase 3 of the plan).** The `ToolDefinition` registry and the six §8.2
   built-in tools exist (`src/lib/tools/`), but no agent runtime resolves/invokes them yet. Skills become
   functional here (inject bodies into the system prompt). Built-in tool backends and a native stdio
   MCP transport are plan Phases 4–5 (the six tools are stubs; MCP stdio can't spawn in the webview).

### B. Phase 2 — Workflow Builder (spec §3.3)
   Visual node graph for chaining agents and tools. `workflows` table is already in the schema;
   no UI or runtime exists yet. Needs its own design pass + plan.

### C. Phase 3 — Autonomous Executor (spec §3.3)
   Goal → decompose → sub-agents → approval flow. Largest, least-specified; do last.

---

## Backlog / explicitly out of scope (spec §11)

Mobile app · cloud sync (libSQL/Turso) · vector-DB semantic memory · public agent/workflow
marketplace · real-time multi-user collaboration · video-editing agent runtime. Revisit only
after Phase 2.

---

## Known Risks

- **Rust tests blocked on this host.** The `tauri` `test`/`MockRuntime` dev-dependency breaks
  the Rust test binaries on this Windows machine. Pattern: extract `AppHandle`-free helper
  functions and unit-test those instead of `#[command]` handlers directly. (See user memory
  `project_tauri_test_feature_broken`.)
- **Desktop binary never launched.** All confidence is from unit tests + `cargo check`. The
  first real `tauri:dev` run may surface IPC, plugin-permission, or capability-config issues
  that mocks can't catch.
- **Next.js is a breaking-changes fork** (per `AGENTS.md`): read `node_modules/next/dist/docs/`
  before writing Next.js code — APIs differ from training data.

---

## Changelog

- **2026-06-19** — **Fixed: LLM agents showed "running" then nothing.** In AI SDK v6, `streamText`
  surfaces failures (missing/invalid key, wrong model, network) as an `error` part in `fullStream`
  rather than throwing; `llm-agent.ts` ignored every non-`text-delta` part, so errors were swallowed
  (status went running→idle, blank panel). Now the run loop handles `error` parts (and wraps the body
  in try/catch), yielding an `error` `AgentEvent`; `ChatPanel` renders it as a visible (ephemeral,
  non-persisted) message and sets `error` status. Also fixed two latent bugs in the same loop: the
  agent's `systemPrompt` and prior conversation history are now passed to `streamText` (previously
  only the latest line was sent, with no system prompt). Added a friendly missing-key error in
  `router.ts`. Drive-by: added `GoogleProvider.authType` (build-breaker once `@ai-sdk/google` resolves).
  Verified: `npx vitest run` → **338 passing / 64 files**; `npx tsc --noEmit` clean. ⚠️ Not yet
  confirmed on a real `tauri:dev` round-trip. (Plan: `i-noticed-that-when-harmonic-pearl.md`, Phase 1.)
- **2026-06-18** — Documentation overhaul: rewrote `README.md` (badges, ToC, Mermaid
  architecture/event-flow/vault-unlock diagrams, accurate 6-provider + tool-registry coverage);
  added `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`; de-staled this ledger (SQLCipher, Gemini,
  and the tool registry moved Done → recorded as shipped; "Next" trimmed). Re-ran the suite for an
  honest baseline: **332 passing / 1 failing** (stale provider-keys assertion missing `'google'`).
  Docs only — no product/source changes.
- **2026-06-18** — Fixed broken desktop (Tauri) bundling: added `output: 'export'` to
  `next.config.ts` so `next build` emits the `out/` directory that `tauri.conf.json`'s
  `frontendDist: ../out` bundles (previously `next build` emitted `.next/`, so the desktop app
  shipped no frontend). Verified `npm run build` → `out/index.html` + assets, `npm test` → 242
  passing, and `npm run dev` still serves. Full `tauri:build` (native Rust compile) not run.
- **2026-06-18** — Established this progress ledger. Phase 1 verified at 242 passing tests
  (48 files). No code changes; documentation only.
- **2026-06-18** — Subscription "login" via official CLIs (Tasks 1–9): `claude-cli`/`codex-cli`
  providers + `CliLanguageModel`, `run_process_blocking` Rust command, CLI auth-status/login,
  Settings sign-in UI; also fixed the `CreateAgentPanel` agent-type resolution bug. Suite now
  **284 tests / 56 files**; Rust `cargo test process::tests` green. Coding-agent flag
  modernization (Task 10) deferred. Not yet run on a real desktop build.
