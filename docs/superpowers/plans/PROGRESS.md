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
| **Phase** | Workflow Builder **W2 (control flow)** landed — `conditional` (branch via the engine's existing readiness pruning), `transform` (eval-free `{{path}}` templating), and `loop` (iterate a referenced sub-workflow, bounded) — **no engine change needed**. Remaining: Workflow Builder **W3** (data-wiring UX + run history), then **Autonomous Executor** (spec §3.3). |
| **Verified baseline** | `npx vitest run` → **529 passing · 93 files** (observed 2026-06-19, post Workflow-Builder-W2; run from the worktree, not the main checkout). `npx tsc --noEmit` → **clean (exit 0)**. `npm run build` → static export OK (`out/index.html`). Web-mode Playwright e2e → **5/5 pass**. `cargo test` (src-tauri) → **32 passing** (unchanged; W1/W2 added no Rust). Note: running the suite locally requires `@ai-sdk/google` present in `node_modules` — a declared dependency repeatedly wiped by `git worktree remove --force` deleting *through* agent worktrees' `node_modules` junctions (restore with `npm ci` + `npm install --no-save @ai-sdk/google@3.0.83`; don't `--force`-remove junction-bearing worktrees). |
| **TypeScript** | Product code clean; `npx tsc --noEmit` exits 0. (Fixed: `GoogleProvider` was missing the required `authType` field — a build-breaker surfaced once `@ai-sdk/google` resolves.) |
| **Desktop app run** | ⚠️ **Never verified end-to-end.** `npm run tauri:dev` has not been run on a real host. The LLM-agent no-response fix, the Phase 3–5 runtime (tool calls, real file/shell execution, approval round-trips, MCP connect), and Workflow Builder W1 (persist/list/run a workflow — needs the SQLite vault + a real agent node) all need a real desktop round-trip to confirm. |
| **Rust tests** | ✅ `cargo test` (src-tauri) green — **32 passing** (AppHandle-free helpers, incl. the new `fs.rs` path-guard tests). MockRuntime command-level tests stay behind the `mock-runtime-tests` feature (off on this host). |
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
3. ✅ **Attach tools/MCPs/skills to agents (Phase 2 of the plan) — DONE** (Changelog 2026-06-19). MCP→agent
   assignment in the Store, a new `EditAgentPanel` (edit name/model/prompt + multi-select tools/MCPs/skills),
   `AgentRepository.updateMcpIds`/`update`, kind-aware `useAgentAssignments`, and an edit affordance on the
   agent card. ⚠️ Assignments are stored but **not yet consumed at runtime** — that's item 4.
4. ✅ **Wire the tool-call loop (Phase 3 of the plan) — DONE** (Changelog 2026-06-19). The LLM runtime now
   resolves an agent's assigned tools/skills and runs a bounded multi-step tool-call loop: `resolveCapabilities`
   (`src/lib/agents/capabilities.ts`) maps `toolIds` → `TOOL_REGISTRY` executables and loads `skill:` bodies;
   `toAiTool` (`src/lib/agents/tool-adapter.ts`) wraps each `ToolDefinition` as a v6 `tool()` behind an approval
   gate; `llm-agent.ts` injects skill bodies into the system prompt, passes `tools` + `stopWhen: stepCountIs(8)`,
   and emits `tool-call`/`tool-result` events; a promise-based `approval-gate.ts` + inline `ApprovalGate` in
   `ChatPanel` gate dangerous tools (`shell`/`file_write`). ✅ As of Phase 4 the file/shell tools have real
   backends; assigned MCP servers stay dormant until Phase 5 (stdio transport).

### Remaining work (post-Phase-4)
- ✅ **Phase 4 — built-in tool backends — DONE** (Changelog 2026-06-19). `file_read`/`file_write` via a new
  `src-tauri/src/commands/fs.rs` (+ `src/lib/fs.ts` bridge, with a lexically-normalized allow-list re-check on
  the Rust side); `shell` via the existing `run_process_blocking`; `web_search`/`browser`/`image_generation`
  now throw clear "needs configuration in Settings" errors. The dead `notWiredYet` helper was retired.
  ⚠️ Real file/shell execution is desktop-only (web `invoke` rejects) — verified by `cargo test` (32 passing,
  incl. 7 `fs::` path-guard tests) + unit tests; a live round-trip still needs `tauri:dev`.
- ✅ **Phase 5 — MCP servers connect — DONE** (Changelog 2026-06-19). New `src/lib/mcp/tauri-stdio-transport.ts`
  frames MCP JSON-RPC over `spawn_process`/`send_stdin`/stdout-events; `registry.ts` uses it for stdio when
  `isTauri()` (stdio is otherwise rejected, and the SDK's Node stdio transport is no longer bundled — that kept
  `next build` green); `llm-agent` connects assigned `mcpServerIds`, lists their tools, and exposes them as
  `mcp__<serverId>__<tool>` via `toAiMcpTool`, skipping any server that fails to connect. ⚠️ stdio MCP is
  desktop-only; SSE works in-renderer; a live MCP round-trip needs `tauri:dev`.
- **Workflow Builder (spec §3.3)** and **Autonomous Executor (spec §3.3)** — the last two roadmap items.
  Each needs its own design pass (brainstorming + plan) before decomposition; see below.

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

- **2026-06-19** — **Workflow Builder W2 landed: control flow** (plan
  [`2026-06-19-workflow-builder-w2.md`](2026-06-19-workflow-builder-w2.md); built by 4 parallel worktree
  tasks + a foundational `expr.ts` done inline, each Tier-1 QA'd; the `loop` node got a dedicated
  adversarial QA). Three new node types: **`conditional`** (a structured `{path,op,value}` predicate routes
  the input to a single `true`/`false` output — the W1 readiness engine prunes the other branch, **so no
  engine change was needed**), **`transform`** (eval-free `{{path}}` template substitution → JSON-or-string),
  and **`loop`** (iterate a *referenced sub-workflow* over an array via recursive `runWorkflow`, bounded by a
  `maxIterations` cap, default 100). Shared eval-free helpers in `src/lib/workflows/expr.ts` (`getPath` /
  `applyTemplate` / `evalPredicate` — no `eval`, no string-expression parser, §9.3 zero-trust). All three
  registered in `WORKFLOW_NODE_REGISTRY` (exhaustive test → 8 keys). Verified: `npx tsc --noEmit` clean;
  `npx vitest run` → **529 passing / 93 files** (+23); `eslint` on changed files → no errors; `npm run build`
  → `out/` emitted; the four pre-existing registry tests untouched. ⚠️ Known follow-up (QA minor): a `loop`
  whose sub-workflow transitively points back at an ancestor is depth-unguarded (each level is bounded, but
  there's no cross-level depth/visited guard) — a hardening item, not a blocker. Real branch/loop execution
  is desktop-gated (loop needs the SQLite vault for its sub-workflow). Remaining: **W3** (data-wiring UX + run
  history), then the **Autonomous Executor**.
- **2026-06-19** — **Workflow Builder W1 landed: core engine + editor** (brainstorm → spec
  [`2026-06-19-workflow-builder-design.md`](../specs/2026-06-19-workflow-builder-design.md) → plan
  [`2026-06-19-workflow-builder-w1.md`](2026-06-19-workflow-builder-w1.md) → built by ~14 parallel
  worktree tasks in dependency waves, each Tier-1 adversarially QA'd; engine + editor + panel got
  dedicated QA passes). New `WorkflowNodeDef` registry (`WORKFLOW_NODE_REGISTRY`) with five node types
  (`start`/`agent`/`tool`/`output`/`join`); a `workflows` + `workflow_runs` storage layer; an in-process
  **readiness execution engine** (`src/lib/workflows/engine.ts` — a node runs once its inputs are ready,
  independent nodes run concurrently, `join` barriers); `workflow:*` bus events + a `useWorkflowRun`
  hook; and a dedicated React Flow **WorkflowEditor** (palette · port-wired edges · config rail · Run
  modal · live per-node status) reached via the new **Workflows** panel in the sidebar. Verified:
  `npx tsc --noEmit` clean; `npx vitest run` → **506 passing / 89 files** (+95); `eslint` on changed
  files → no errors; `npm run build` → `out/` emitted (static export intact — the editor bundles
  cleanly); web e2e → 5/5 (Workflows nav opens the panel). The four pre-existing exhaustive registry
  tests are untouched; W1 adds a new `WORKFLOW_NODE_REGISTRY` exhaustive test. ⚠️ Persisting/listing/
  **running** a workflow needs the desktop SQLite vault (+ a real agent for `agent` nodes) — a
  `tauri:dev` checklist. Remaining: **W2** (conditional/loop/transform) + **W3** (data-wiring UX + run
  history), then the **Autonomous Executor**.
- **2026-06-19** — **Phase 5 landed: MCP servers connect** (implemented solo in the integration worktree —
  the parallel-agent model was thrashing the shared `node_modules` via competing installs, so a single-writer
  pass was safer; adversarially Tier-1 QA'd after). New `src/lib/mcp/tauri-stdio-transport.ts`: an MCP
  `Transport` that frames newline-delimited JSON-RPC over the existing `spawn_process` (stdout already emitted
  line-by-line) + `send_stdin` + `kill_process`. `registry.ts` selects it for stdio when `isTauri()` and
  **drops the static `StdioClientTransport` import** — once `llm-agent` reached the registry, that Node import
  pulled `cross-spawn`/`child_process` into the static web bundle and broke `next build`; stdio is now
  desktop-only (rejected in web), SSE stays (browser-safe). `llm-agent.run` connects each assigned
  `mcpServerId`, lists its tools, and exposes them as `mcp__<serverId>__<tool>` via `toAiMcpTool` →
  `registry.callTool`, skipping (logging, not aborting) any server that fails to connect. Verified:
  `npx tsc --noEmit` clean; `npx vitest run` → **411 passing / 76 files** (+8); `eslint` no new errors;
  **`npm run build` green** (`out/` emitted — static export preserved); `cargo` unchanged (no Rust). Only
  `mcp-registry.test.ts` changed among the registry tests (behavioral: stdio now via the Tauri transport;
  connect/disconnect assertions preserved) — the node/agents/tools key-list tests are untouched. ⚠️ A live MCP
  round-trip (spawning a real `npx @modelcontextprotocol/server-*`) needs `tauri:dev`. (Plan:
  `i-noticed-that-when-harmonic-pearl.md`, Phase 5.)
- **2026-06-19** — **Phase 4 landed: native built-in tool backends** (3 parallel tasks: 2 worktree agents for
  the JS-only tools + the Rust filesystem backend done in the integration worktree; each Tier-1 adversarially
  QA'd). `file_read`/`file_write` now read/write via a new `src-tauri/src/commands/fs.rs`
  (`fs_read_text`/`fs_write_text`, registered in `mod.rs` + `lib.rs`) through a new `src/lib/fs.ts` bridge; the
  Rust side re-checks the path against the agent's `allowedPaths` with a **lexically-normalized, component-wise
  containment check** (defeats `..` traversal and sibling-prefix tricks that the JS `startsWith` guard would
  miss). `shell` runs via the existing `run_process_blocking`. `web_search`/`browser`/`image_generation` throw
  clear "needs configuration in Settings" errors instead of the stale `notWiredYet` (now retired); each tool
  keeps its permission guard first and refuses in web mode via `isTauri()`. Verified: `npx tsc --noEmit` clean;
  `npx vitest run` → **403 passing / 75 files** (+19); `eslint` on changed files → clean; `npm run build` →
  `out/` emitted; **`cargo test` → 32 passing** (incl. 7 new `fs::` tests covering traversal/sibling/empty-list
  rejection + round-trip). The exhaustive registry key-lists are untouched; one stale *behavioral* assertion in
  `tools/__tests__/registry.test.ts` (shell "defers to Phase 2") was refreshed to the new desktop-only error.
  ⚠️ **Real file/shell execution is desktop-only** (web `invoke` rejects) — the live round-trip needs
  `tauri:dev`. `web_search`/`browser`/`image_generation` remain provider-stubs (real providers are a follow-up).
  (Plan: `i-noticed-that-when-harmonic-pearl.md`, Phase 4.)
- **2026-06-19** — **Phase 3 landed: in-process runtime tool-call loop** (built by 5 parallel worktree
  agents, each Tier-1 adversarially QA'd, integrated via cherry-pick A→D→B→C→E). New `approval-gate.ts`
  (promise-based bus approval plumbing), `capabilities.ts` (`resolveCapabilities`: toolIds→registry execs +
  `skill:` bodies, missing→warning), `tool-adapter.ts` (`toAiTool` → v6 `tool()` with an approval gate;
  `shell`/`file_write` gated; `toAiMcpTool` stub for P5). `llm-agent.ts` now injects skill bodies into the
  system prompt, passes `tools` + `stopWhen: stepCountIs(8)`, translates `tool-call`/`tool-result`/`tool-error`
  parts, and delegates `approve`/`deny`/`stop` to the gate (fixing the old session-vs-requestId stop bug).
  `ChatPanel` renders live 🔧 tool-transcript rows (display-only, never persisted/replayed) + an inline
  `ApprovalGate` filtered to the active agent. Verified: `npx tsc --noEmit` clean; `npx vitest run` →
  **384 passing / 68 files** (+31 over Phase-2 baseline); `eslint` on changed files → no new errors (the 2
  pre-existing ChatPanel errors are unchanged from base); `npm run build` → `out/` emitted; web-mode Playwright
  e2e → 4/4. Four exhaustive registry tests untouched. ⚠️ **Skills work end-to-end; the six built-in tools
  still `throw notWiredYet()` (Phase 4) and assigned MCP servers stay dormant (Phase 5).** The live
  LLM-round-trip / real-tool / approval-round-trip path needs a desktop `tauri:dev` run (web mode has no
  keychain/vault/DB). (Plan: `i-noticed-that-when-harmonic-pearl.md`, Phase 3.)
- **2026-06-19** — **Phase 2 landed: attach tools/MCPs/skills to agents** (built by 4 parallel worktree
  agents, integrated via cherry-pick A→C→B→D). Added `AgentRepository.updateMcpIds`/`update`; made
  `useAgentAssignments` kind-aware (tool vs mcp); added `useInstalledMcps.installedId`; wired MCP→agent
  assignment into the Store; new `EditAgentPanel` (edit name/model/system-prompt + multi-select
  tools/MCPs/skills, persisting via the repo); added an edit affordance on the agent card threaded
  through the canvas to `page.tsx`. Disjoint file ownership + locked contracts → conflict-free merge.
  Verified: `npx tsc --noEmit` clean, `npx vitest run` → **353 passing / 65 files**, no new lint, the
  four exhaustive registry tests untouched. ⚠️ Assignments are stored but **not consumed at runtime yet**
  (that's the Phase-3 tool-call loop). (Plan: `i-noticed-that-when-harmonic-pearl.md`.)
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
