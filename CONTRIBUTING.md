# Contributing to Agent Command Center

Thanks for your interest in contributing. This guide covers local setup, the conventions the
codebase follows, and how to add a new capability the idiomatic way. For the deep architectural map,
read [CLAUDE.md](CLAUDE.md); for project status and what's verified, read
[`docs/superpowers/plans/PROGRESS.md`](docs/superpowers/plans/PROGRESS.md) **first**.

## Before you start

- **This is Next.js 16, React 19, and the Vercel AI SDK v6** — APIs differ from older versions you
  may remember. The framework docs ship in `node_modules/next/dist/docs/`; read the relevant guide
  before writing app/framework/AI-SDK code. See [AGENTS.md](AGENTS.md).
- **Mental model:** a client-side SPA (`src/app/page.tsx` is `'use client'`, one route) plus a Rust
  sidecar for native capabilities. Runtime data comes from the SQLite plugin, not Server Components.

## Local setup

```bash
npm install
npm run dev          # web mode at http://localhost:3000
npm run tauri:dev    # full desktop app (needs Rust + Tauri prerequisites)
```

Web mode lacks all native features — the OS keychain, the encrypted vault, and subprocess coding
agents are Rust-sidecar commands that reject in the browser. Use the desktop build to exercise them.

## The golden rule: extend by registration

The core design constraint is **add a new capability by implementing an interface and registering it
in a `Map` — never by editing existing code.** The contracts live in `src/lib/interfaces/` and are
barrel-exported (types only) from `@/lib/interfaces`.

| Concept | Interface | Registry |
|---------|-----------|----------|
| Agent runtime | `AgentProvider` | `AGENT_REGISTRY` (`src/lib/agents/registry.ts`) |
| LLM provider | `LLMProvider` | `PROVIDER_REGISTRY` (`src/lib/llm/providers/index.ts`) |
| Canvas node | `CanvasNode` | `NODE_REGISTRY` (`src/lib/canvas/node-registry.ts`) |
| Tool | `ToolDefinition` | `TOOL_REGISTRY` (`src/lib/tools/registry.ts`) |
| App event | `AppEvent` union (`src/lib/interfaces/event-bus.ts`) | `getEventBus()` |

The most common recipes are encoded as **project skills** in `.claude/skills/`. Prefer them over
reconstructing the steps by hand:

| Skill | Use when |
|-------|----------|
| `add-llm-provider` | Onboarding a new LLM vendor |
| `add-storage-table-repository` | Persisting a new entity (table + repository) |
| `add-tauri-command` | Exposing a new native capability from the Rust sidecar |
| `add-app-event-and-hook` | Adding a cross-cutting event + a consumer hook |
| `new-feature-panel` | Building a new settings/agents/chat/store panel or dialog |

## Conventions

**Components**
- Every interactive component starts with `'use client'` and declares a `<Name>Props` interface.
- **Do not** use `src/components/ui/*` or the oklch design tokens for feature panels. Feature
  components hand-roll raw HTML in a hardcoded zinc/indigo dark palette — copy a sibling's exact
  class recipes (`bg-[#0d0d0f]`, `border-white/[0.08]`, `focus:border-indigo-500/50`, bracket font
  sizes like `text-[13px]`).
- Export style is per folder: `settings/`, `agents/`, `chat/` use **default** exports; `layout/`,
  `canvas/`, `store/`, `approval/`, `vault/` use **named** exports. Match the sibling.

**Storage**
- Schema is **migrations-as-constants**: each table is a `CREATE TABLE IF NOT EXISTS` constant in
  `src/lib/storage/schema.ts`, appended to the ordered `ALL_MIGRATIONS` array (order is load-bearing
  for foreign keys — a referenced table must come first). There is no ALTER / down-migration path.
- One hand-written repository per table. DB columns are `snake_case`; app-facing `*Row` interfaces
  are `camelCase`; a private `deserialize()` is the single translation point. Ids via
  `crypto.randomUUID()`; SQL uses positional `$1..$n` params; JSON columns are stringified/parsed;
  booleans stored as `0/1`. Re-export each new repository from `src/lib/storage/index.ts`.

**Secrets**
- API keys and tokens go **only** into the OS keychain via `src/lib/keychain.ts`. SQLite stores only
  a *reference* (e.g. `providerId + '-key'`). Never write a secret value into the database.

**Rust sidecar**
- Commands live in `src-tauri/src/commands/<domain>.rs` as `#[command] pub fn` returning
  `Result<T, String>`. **Registration is two places in `src-tauri/src/lib.rs`** — the `use` import
  *and* the `generate_handler!` list — plus `pub mod <domain>;` in `commands/mod.rs`. Front end calls
  via thin TS bridges using `invoke('snake_case_name', { camelCaseArg })`.

## Testing

- **Vitest + jsdom**, globals on, co-located in `__tests__/` as `*.test.ts(x)`. Import
  `describe/it/expect/vi` from `'vitest'` explicitly.
- **Mock the Tauri boundary** at module level (`@tauri-apps/api/core`, `@tauri-apps/api/event`,
  `@tauri-apps/plugin-sql`) — it doesn't exist in jsdom. Use `vi.hoisted()` for values a `vi.mock`
  factory closes over.
- **Keep exhaustive registry tests in sync.** When you register a new provider/agent/tool, update the
  assertions in `src/lib/llm/providers/__tests__/index.test.ts` and
  `src/lib/agents/__tests__/registry.test.ts` — they assert the *exact* sorted key set and will fail
  otherwise.
- Run the suite with `npm test`; Rust tests with `cargo test` in `src-tauri/`. Playwright specs live
  only in `e2e/*.spec.ts` and run with `npx playwright test`.

## Pull requests

1. Branch off `main`.
2. Keep changes focused; follow the conventions above and match nearby code.
3. Make sure `npm run lint` and `npm test` pass. Update
   [`docs/superpowers/plans/PROGRESS.md`](docs/superpowers/plans/PROGRESS.md) and
   [CHANGELOG.md](CHANGELOG.md) when you land a meaningful unit of work.
4. Open the PR with a clear description of *what* and *why*.

## Reporting security issues

Please do **not** open a public issue for security vulnerabilities. See [SECURITY.md](SECURITY.md)
for responsible-disclosure instructions.
