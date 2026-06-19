# Agent Command Center — Agent Guide

A **Tauri 2 + Next.js 16** desktop app (also runs as a plain web app) for managing AI agents
on a spatial canvas. One React/TypeScript codebase; native capabilities come from a Rust sidecar.

> **Mental model:** this is effectively a **client-side SPA**. `src/app/page.tsx` is `'use client'`,
> everything renders client-side, and runtime data comes from the **Tauri SQLite plugin** — not from
> Server Components or `fetch`. There is one route.

## Read the framework docs first

@AGENTS.md

This is **Next.js 16** and the **Vercel AI SDK v6** (`@ai-sdk/*` v3) — APIs differ from older
versions you may remember. **Before writing app/framework/AI-SDK code, read the relevant guide.**
The docs ship in `node_modules/next/dist/docs/` — but **this git worktree has no `node_modules`**
(dependencies are installed only in the main checkout). Read them at
`C:/Projects/node_modules/next/dist/docs/` (Next 16.2.9).

## Architecture: extension by registration

The core design constraint is **add a new capability by implementing an interface and registering
it in a Map — never by editing existing code.** The contracts live in `src/lib/interfaces/`:

| Concept | Interface | Registry / list |
|---|---|---|
| Agent runtime | `src/lib/interfaces/agent-provider.ts` | `AGENT_REGISTRY` — `src/lib/agents/registry.ts` |
| LLM provider | `src/lib/interfaces/llm-provider.ts` | `PROVIDER_REGISTRY` — `src/lib/llm/providers/index.ts` |
| Canvas node | `src/lib/interfaces/canvas-node.ts` | `NODE_REGISTRY` — `src/lib/canvas/node-registry.ts` |
| Tool | `src/lib/interfaces/tool-definition.ts` | (Phase 2) |
| App event | `src/lib/interfaces/event-bus.ts` (`AppEvent` union) | `getEventBus()` — `src/lib/event-bus.ts` |
| MCP store item | — | `MCP_CATALOG` — `src/lib/store/catalog.ts` |

Interface types are barrel-exported from `src/lib/interfaces/index.ts` (a **types-only** barrel,
`export type *`). Import them from `@/lib/interfaces`, not the individual files. `@/` → `src/`.

### Project layout
```
src/app/          Next App Router; page.tsx is the canvas shell (one client route)
src/components/    canvas/ agents/ approval/ chat/ settings/ layout/ store/ ui/  (+ co-located __tests__/)
src/hooks/         React hooks bridging the event bus / storage to component state
src/lib/
  interfaces/      the extensibility contracts (start here)
  agents/          AgentProvider implementations + AGENT_REGISTRY
  llm/             LLM router + providers/ (+ PROVIDER_REGISTRY)
  canvas/          NODE_REGISTRY + canvas persistence
  storage/         SQLite schema (migrations-as-constants) + one repository per table
  mcp/  store/      MCP registry + store catalog
  event-bus.ts     typed in-process pub/sub  ·  keychain.ts  OS keychain bridge
src-tauri/         Rust sidecar: keychain + child-process commands
e2e/               Playwright (web-mode) end-to-end tests
docs/              design spec + implementation plans
```

## Storage layer

- **Schema is migrations-as-constants**, not a migration framework: every table is a
  `export const CREATE_* = `CREATE TABLE IF NOT EXISTS …`` in `src/lib/storage/schema.ts`,
  appended to the ordered `ALL_MIGRATIONS` array. `initDb()` runs them all on startup; they're
  idempotent. There is no ALTER/down-migration mechanism — only additive `CREATE`s.
  **`ALL_MIGRATIONS` order is load-bearing for foreign keys** (a referenced table must come first).
- **One hand-written repository per table** under `src/lib/storage/repositories/`. DB columns are
  `snake_case`; app-facing `*Row` interfaces are `camelCase`; a private `deserialize()` is the single
  translation point. Ids are generated in JS via `crypto.randomUUID()`; SQL uses positional `$1..$n`
  params; JSON columns are `JSON.stringify`/`parse`d; booleans stored as `0/1`.
- Re-export each new repository (class + `*Row` type) from `src/lib/storage/index.ts`.
- **Access pattern:** `const db = await initDb(); const repo = new XRepository(db)`.

## Native / Rust sidecar

- Commands live in `src-tauri/src/commands/<domain>.rs`, are `pub fn` annotated `#[command]`, and
  return `Result<T, String>` (`.map_err(|e| e.to_string())`).
- **Registration is two places in `src-tauri/src/lib.rs`:** the `use` import AND the
  `tauri::generate_handler![…]` list. Miss either and `invoke()` fails at runtime with "command not
  found". A new command file also needs `pub mod <domain>;` in `src-tauri/src/commands/mod.rs`.
- The front end calls commands through thin TS bridges (canonical: `src/lib/keychain.ts`) using
  `invoke('snake_case_name', { camelCaseArg })` — **Tauri v2 maps camelCase JS keys to snake_case
  Rust params**.
- Custom `#[command]`s need **no** entry in `src-tauri/capabilities/default.json` — that file holds
  Tauri plugin/core permissions (it currently lists only `core:default`), not custom-command entries.

## Secrets policy

**API keys and tokens go ONLY into the OS keychain**, via the Rust commands wrapped by
`src/lib/keychain.ts` (`get/set/deleteSecret`). SQLite stores only a *reference* — by convention
`providerId + '-key'` (e.g. `models.api_key_ref`). Never write a secret value into the database.

## Event bus + hooks

- Singleton `getEventBus()` from `@/lib/event-bus`; `createEventBus()` is for isolated test instances.
- To add an event: define an interface with a namespaced string-literal `type` and a
  `timestamp: number`, then add it to the **`AppEvent` union** in `src/lib/interfaces/event-bus.ts`.
  That union entry is the *only* registration step — `event-bus.ts` needs no change. A mistyped `type`
  silently matches no listener (emit is a no-op for unknown types, not an error).
- Consumer hooks subscribe in a `useEffect` via `getEventBus().on(type, handler)` and **return the
  unsubscribe** for cleanup; per-entity hooks filter by id inside the handler and reset state when the
  id changes.
- **`AgentEvent` ≠ `AppEvent`.** `AgentEvent` (in `agent-provider.ts`) is what `AgentProvider.run`
  yields; `ChatPanel.tsx` is the translation layer that maps those into typed `AppEvent`s.

## UI conventions

- Every interactive component starts with `'use client'` and declares a `<Name>Props` interface.
- **Do NOT use `src/components/ui/*` or the oklch design tokens for feature panels.** Despite
  `components.json` advertising shadcn + base-ui, `ui/` contains only an unused `button.tsx` (no
  Dialog/Input/Select), and the oklch theme tokens in `globals.css` are essentially only consumed by
  it. Feature components **hand-roll raw HTML in a hardcoded zinc/indigo dark palette** — copy a
  sibling's exact class recipes (`bg-[#0d0d0f]`, `border-white/[0.08]`, `focus:border-indigo-500/50`,
  white primary buttons, bracket font sizes like `text-[13px]`).
- Export style depends on the folder: `settings/`, `agents/`, `chat/` use **default** exports;
  `layout/`, `canvas/`, `store/`, `approval/` use **named** exports. Match the sibling.
- Panels are wired into `src/app/page.tsx`, gated on `activeNav`; respect existing `onClose` contracts.

## Commands

| Task | Command |
|---|---|
| Web dev server | `npm run dev` (Next 16 → **Turbopack by default**, port 3000) |
| Web production build | `npm run build` |
| Desktop dev | `npm run tauri:dev` |
| Desktop build | `npm run tauri:build` |
| Lint | `npm run lint` (runs **`eslint`** directly — `next lint` was removed in Next 16) |
| Unit/component tests | `npm test` (Vitest) |
| E2E tests | `npx playwright test` |
| Rust tests | `cargo test` in `src-tauri/` (see host note) |

## Testing

- **Vitest + jsdom**, globals on, setup `src/test-setup.ts`. Tests are **co-located** in `__tests__/`
  dirs as `*.test.ts(x)`. Import `describe/it/expect/vi` from `'vitest'` explicitly (every file does).
- **Mock the Tauri boundary** at module level — it doesn't exist in jsdom: `@tauri-apps/api/core`
  (`invoke`), `@tauri-apps/api/event` (`listen`), `@tauri-apps/plugin-sql` (`default.load`). Use
  `vi.hoisted()` for values a `vi.mock` factory closes over. Mock `@/lib/event-bus` to drive hooks.
- Repos assert the exact SQL string + positional params against a mock `db`. Reset the `db.ts`
  singleton with `vi.resetModules()` when a test needs a fresh one.
- **Playwright is web-mode only** (Chromium vs `next dev`); specs live **only** in `e2e/*.spec.ts`
  (excluded from Vitest). Native persistence (keychain/SQLite) is out of scope there.
- **Rust:** `cargo test` runs AppHandle-free unit tests by default. Tests needing a Tauri
  `MockRuntime` are gated behind the `mock-runtime-tests` Cargo feature (see gotcha) — run them on
  Linux/CI with `cargo test --features mock-runtime-tests`.

## Critical gotchas

- **Tauri `MockRuntime` breaks `cargo test` on this Windows host** with `STATUS_ENTRYPOINT_NOT_FOUND`
  (0xc0000139). **Do NOT add `tauri = { features = ["test"] }` as a plain dev-dependency.** It's gated
  behind the opt-in `mock-runtime-tests` feature (`Cargo.toml`); extract AppHandle-free logic into free
  functions and unit-test those locally.
- **Exhaustive registry-test assertions** break unrelated test files when you register anything new:
  `src/lib/llm/providers/__tests__/index.test.ts` asserts the sorted provider keys, and
  `src/lib/agents/__tests__/registry.test.ts` the agent keys. Update those arrays when you add one.
- **Next 16 ≠ training data:** Turbopack is the default (a custom `webpack` config fails the build
  without `--webpack`); `cookies()/headers()/params/searchParams` are **async** and must be awaited;
  `next lint` is removed; `middleware` is renamed `proxy`. Read the docs (path above) before relying
  on any Next API.
- **Desktop bundling is currently broken by config:** `src-tauri/tauri.conf.json` points `frontendDist`
  at `../out`, but `next.config.ts` lacks `output: 'export'`, so `next build` emits `.next/`, not
  `out/`. A real desktop build needs `output: 'export'` added (and its static-export constraints
  accepted). *(Known issue; fix deliberately, not by accident.)*
- **`listModels` that does a real fetch must throw on failure**, never return `[]` — an unreachable
  server must be distinguishable from "zero models" (regression fixed in commit `391cabc`; the Ollama
  tests assert the throw).
- **Two hardcoded provider display-name maps** (`AddProviderForm.tsx` and `AddModelDialog.tsx`) plus
  Ollama-style `baseUrl`-vs-`apiKey` credential branches must both be updated when adding a
  `baseUrl`/no-key LLM provider, or it's mis-persisted as an `apiKey` provider.

## Host-specific notes (this machine)

- **`cargo` is not on `PATH`** in the shell. Use the full path
  `C:\Users\chris\.rustup\toolchains\stable-x86_64-pc-windows-msvc\bin\cargo.exe` (and prepend that
  bin dir to `PATH` so build scripts find `rustc`).
- **This worktree has no `node_modules`** — `npm`/`npx`/Vitest/Playwright resolve dependencies only in
  the main checkout. Install deps here first if you need to run them, or run from the main checkout.
- **Web mode lacks all native features** — `invoke()` and `@tauri-apps/plugin-sql` reject in the
  browser; `page.tsx` intentionally swallows the resulting `initDb` errors.

## Project skills

Repeatable, gotcha-laden recipes are encoded as skills in `.claude/skills/` — prefer them over
reconstructing the recipe by hand:

| Skill | Use when |
|---|---|
| `add-llm-provider` | Onboarding a new LLM vendor (Google, Groq, Mistral, LM Studio, …) |
| `add-storage-table-repository` | Persisting a new entity (new SQLite table + repository) |
| `add-tauri-command` | Exposing a new native capability from the Rust sidecar |
| `add-app-event-and-hook` | Adding a cross-cutting event + a consumer hook |
| `new-feature-panel` | Building a new settings/agents/chat/store panel or dialog |
