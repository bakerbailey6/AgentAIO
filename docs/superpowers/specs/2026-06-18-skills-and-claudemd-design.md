# Project Skills + CLAUDE.md — Design Spec

**Date:** 2026-06-18
**Status:** Approved

---

## 1. Goal

Give contributors (human and agent) two things this repo currently lacks:

1. **Project-specific skills** that encode the codebase's repetitive, multi-file,
   gotcha-laden "add a new X" recipes so a change is complete and green the first time.
2. **A comprehensive `CLAUDE.md`** that orients a fresh agent fast — architecture,
   where things live, build/test commands, and the critical gotchas — while keeping
   the existing `@AGENTS.md` include (the Next.js-16 "not the Next.js you know" warning).

The codebase is **Agent Command Center**: a Tauri 2 + Next.js 16 desktop app for managing
AI agents, built on the principle of **extension-by-registration** — five pluggable seams
(`src/lib/interfaces/`), each with a registry. Each seam's "add a new instance" flow is a
rigid template with non-obvious traps, which is exactly what skills are good at.

## 2. Deliverables

### 2.1 Five skills under `.claude/skills/<name>/SKILL.md`

| Skill | Trigger summary | Encodes |
|---|---|---|
| `add-llm-provider` | Onboard a new LLM vendor (Google, Groq, Mistral, LM Studio…) | provider file → registry → **both** UI display-maps → baseUrl/apiKey branch → colocated test → the **exhaustive** `index.test.ts` key array |
| `add-storage-table-repository` | Persist a new entity (new SQLite table) | `CREATE_*` constant + **FK-ordered** append to `ALL_MIGRATIONS` → hand-written repository → `index.ts` barrel re-export → new-style repo test |
| `add-tauri-command` | Expose a new native capability from Rust | `#[command]` in `commands/<domain>.rs` → `mod.rs` → **two-place** registration in `lib.rs` → TS `invoke` bridge → AppHandle-free tests gated behind `mock-runtime-tests` |
| `add-app-event-and-hook` | Add a cross-cutting event + consumer hook | new `AppEvent` union variant → emit with `Date.now()` → hook subscribe/return-unsub → bus-mock test |
| `new-feature-panel` | Build a settings/agents/chat/store panel or dialog | `'use client'` + folder export convention + **hand-rolled zinc/indigo Tailwind** (NOT `components/ui/*` or oklch tokens) + `initDb()+Repository` data access + `page.tsx` wiring + tauri-boundary mock test |

Each `SKILL.md` has YAML frontmatter (`name`, `description` phrased as a trigger) and a body
structured as: **when to use → ordered recipe with exact file paths → conventions → gotchas →
checklist → verify step (`npm test` / `cargo test`)**. Skills reference real files rather than
duplicating code, staying lightweight and high-signal.

### 2.2 A rewritten `CLAUDE.md` (keeps `@AGENTS.md`)

Sections:
1. Project overview (Tauri 2 + Next.js 16; effectively a client-side SPA; data from Tauri SQLite at runtime)
2. Read-the-docs mandate — keep `@AGENTS.md`; note Next 16 docs live at `C:/Projects/node_modules/next/dist/docs/` (this worktree has **no** `node_modules`)
3. Architecture: extension-by-registration — the five interfaces in `src/lib/interfaces/`
4. The registries and where they live (LLM providers, agent runtimes, canvas nodes, MCP catalog)
5. Storage layer (migrations-as-constants, FK order, one repository per table, `initDb()+Repository`)
6. Native/Rust sidecar (two-place command registration, `invoke()` camelCase→snake_case bridge)
7. Secrets policy (keychain only; DB stores a `providerId+'-key'` reference)
8. Event bus + hooks (add a variant to the `AppEvent` union; AgentEvent ≠ AppEvent)
9. UI conventions (hand-rolled zinc/indigo; don't use `components/ui/*` or oklch tokens)
10. Build & run commands (web vs desktop; `eslint` directly, not `next lint`)
11. Test commands & discipline (Vitest + jsdom, colocated `__tests__`, mock the Tauri boundary, Playwright web-mode, `cargo test`)
12. Critical gotchas (the list below)
13. Host-specific notes (cargo not on PATH; web mode lacks native features)
14. Pointers to the new skills

### 2.3 `.gitignore` change

Add `!.claude/skills/` (and `!.claude/skills/**`) after the existing `.claude/` ignore so the
skills are version-controlled and shared, while `settings.local.json` etc. stay ignored.

## 3. Critical gotchas (must appear in CLAUDE.md, and in the relevant skills)

- **Tauri MockRuntime breaks `cargo test` on this Windows host** (`STATUS_ENTRYPOINT_NOT_FOUND`).
  `tauri/test` is gated behind the opt-in `mock-runtime-tests` Cargo feature; default `cargo test`
  runs only AppHandle-free helpers. Full set on Linux/CI: `cargo test --features mock-runtime-tests`.
- **Next.js 16 ≠ training-data Next.js**: Turbopack is default; `cookies()/headers()/params/searchParams`
  are async; `next lint` removed (use `eslint`); `middleware` → `proxy`.
- **Desktop bundling is currently broken**: `tauri.conf.json` points `frontendDist` at `../out`, but
  `next.config.ts` lacks `output: 'export'`, so `next build` emits `.next/`, not `out/`. (Documented as
  a known issue, not fixed by this work.)
- **Exhaustive registry-test assertions** (`providers/__tests__/index.test.ts`, `agents/__tests__/registry.test.ts`)
  silently break unrelated test files when you register anything new.
- **Secrets never touch SQLite** — keychain only; DB stores a `providerId+'-key'` reference.
- **`ALL_MIGRATIONS` order is load-bearing for FKs** — parents before children; never reorder.
- **Two hardcoded display-name maps** (`AddProviderForm.tsx`, `AddModelDialog.tsx`) plus Ollama-style
  baseUrl/apiKey branches must be touched when adding a baseUrl/no-key provider.
- **`listModels` that fetches must throw on failure**, never return `[]` (regression fixed in `391cabc`).

## 4. Out of scope

- Skills for agent-runtimes, canvas-nodes, MCP-catalog (independently assessed as too small /
  already self-documenting — captured as CLAUDE.md prose instead).
- Fixing the `output: 'export'` desktop-bundling issue (documented as a gotcha only).
- Any `node_modules` install or behavioral code change.

## 5. Verification plan

- **RED baseline** (per `writing-skills`): fresh agents attempt each task *without* the skill, judged
  against the known traps — to confirm the skills teach something real. (Result: the well-documented
  code lets careful agents reconstruct most recipes; the skills are efficiency/consistency aids and are
  sharpened to lead with the few traps even primed agents missed.)
- **Adversarial accuracy pass**: every file path and code claim in each skill and in CLAUDE.md is
  checked against the real repo, one skeptical verifier per artifact; flagged issues fixed.
- Documented commands/conventions are verified by reading `package.json`, the configs, and source —
  **not** executed, because this worktree has no `node_modules` (a documented gotcha) and the
  deliverables are documentation that doesn't touch test-covered code.
- Skills are authored following the `writing-skills` skill's format rules.
