---
name: ship-phases
description: Use when the user wants to drive the project's remaining roadmap phases to completion with a concurrent, QA'd team of agents — e.g. "ship the remaining phases", "finish the plan", "run the agent team to complete the project", "complete all phases", "autopilot the roadmap". Discovers remaining phases from the ledger, fans out parallel worktree agents per phase, gates each phase behind two-tier adversarial QA + a code gate + an agent smoke test, and checkpoints with a PR before the next phase.
---

# Ship remaining phases with a QA'd agent team

## Overview

This is an **orchestration playbook**, not a code recipe. You (the main agent) act as the
**orchestrator**: you discover the project's remaining phases from the canonical ledger, and for each
phase you (1) decompose it into the maximum set of **parallel, disjoint-file tasks** behind **locked
interface contracts**, (2) spawn one **concurrent background worktree agent** per task, (3) run **two
tiers of QA** (per-task adversarial review, then a per-phase integration gate), (4) integrate, and
(5) **checkpoint with a PR and pause for the user** before the next phase.

**The verifiable end goal:** every remaining phase implemented AND, for each phase, the **code gate**
green (`tsc --noEmit` + full `vitest` + `eslint` with no new violations + `next build`) **and an
agent-driven smoke test** confirming the phase's user-visible behavior in the running app. The project
is "done" when the ledger shows no remaining phases and the final phase passed both gates.

**Concurrency is *within* a phase.** Phases run **sequentially** — each builds on the previous
(Phase 4 needs Phase 3's loop, etc.). Do not start a phase until the prior phase's PR is approved.

## When to use

- The user wants the remaining roadmap finished by a team of agents working concurrently, with QA.
- Triggers: "ship the phases", "finish the plan", "complete all phases", "run the agent team",
  "autopilot the roadmap", or `/ship-phases`.
- NOT for a single isolated change — use a normal Agent or just do it inline.

## Read first (every run)

- `docs/superpowers/plans/PROGRESS.md` — the canonical status ledger (what's done / next).
- The active plan file(s) under `docs/superpowers/plans/` and `C:\Users\chris\.claude\plans\` — the
  per-phase scope + acceptance criteria. **Trust PROGRESS.md for status**, the plan files for *how*.
- `CLAUDE.md` / `AGENTS.md` — the architecture + the critical gotchas (most are restated below).

## The loop

### Step 1 — Discover the remaining phases
Read the ledger + plan. Produce an **ordered list of remaining phases**, each with: a one-line goal,
its **acceptance criteria** (the user-visible behavior that proves it works), and its verification.
Present this list to the user and get a go-ahead before starting. If the ledger is ambiguous, ask.

### Step 2 — For each remaining phase, in order:

**2a. Decompose into parallel tasks.** Break the phase into the *minimum* number of tasks that
*maximizes* true parallelism, under one hard rule: **each task owns a DISJOINT set of files** (no two
tasks edit the same file). Where one task depends on another's new code, define a **LOCKED CONTRACT**
(exact TS signatures, prop shapes, return types, id conventions) that both sides code to. List, per
task: owned files (create/modify), scope, the contracts it produces/consumes, what it must NOT touch,
and its **acceptance criteria** + targeted `vitest` command. (This is the pattern proven in the
PROGRESS.md "Phase 2 — Parallel execution plan".)

**2b. Fan out — concurrent worktree agents.** Launch all tasks **at once**, each as a background
Opus agent in its own worktree:
`Agent({ subagent_type: "general-purpose", model: "opus", isolation: "worktree",
run_in_background: true, prompt: <self-contained task card with contracts inlined> })`.
Each task prompt MUST instruct the agent to: implement only its owned files; make its targeted
`vitest` pass; commit ONLY its owned files (`git commit -m "feat(phaseN-X): …"`); and report back
**only** its commit SHA (`git rev-parse HEAD`), worktree path, vitest summary, and files changed.
Bake the **standing rules** (below) into every task prompt.

**2c. Tier-1 QA — per task, adversarial.** As each task returns, spawn an **independent QA agent**
(`Explore` or `general-purpose`, read-only) given the task's diff (`git show <sha>`), its acceptance
criteria, and its contract. The QA agent must try to *break* it: contract violations, missing/asserted-
wrong tests, edge cases, files touched outside the owned set, registry-test edits, mock gotchas, dead
code. It returns `{ pass: bool, blocking: [...], notes }`. **Reject → re-dispatch that one task** (via
`SendMessage` to the same agent, or a fresh agent) with the QA feedback; re-QA. Bound at ~2 rounds,
then escalate to the user. Only QA-passed commits proceed.

**2d. Integrate.** Confirm each task commit touches only its owned files
(`git diff-tree --no-commit-id --name-only -r <sha>`) and the file sets are disjoint, then
**cherry-pick in dependency order** (producers before consumers):
`git cherry-pick -x <shaA> <shaC> <shaB> …`. Disjoint files ⇒ conflict-free. (Agent worktrees share the
object DB, so cherry-pick by SHA works from the main worktree.)

**2e. Tier-2 QA — the per-phase gate (the verifiable end goal for this phase).** Run from the repo
root, in order; everything must pass:
1. **Code gate:**
   - `npx tsc --noEmit` → exit 0 (this is the first point cross-task type edges can resolve).
   - `npx vitest run` → full suite green. (`@ai-sdk/google` must be installed — see standing rules.)
   - `npx eslint <changed files>` → **no NEW** violations vs the pre-existing baseline (the repo has a
     few pre-existing ones — `ChatPanel.tsx:41/267`, the `AgentCanvas` ReactFlow-mock `require`/`any`;
     don't fail on those, fail only on new ones).
   - `npm run build` → green (static export to `out/` — keep the desktop bundle buildable).
   - Confirm the **four exhaustive registry tests are untouched & passing**.
2. **Agent smoke test:** spawn a dedicated agent (use the project `verify` / `run` skills) to launch
   the app in **web mode** (`npm run dev`, port 3000) and drive *this phase's acceptance scenario* via
   the browser (Claude-in-Chrome or Preview MCP) and/or by adding+running a Playwright `e2e/*.spec.ts`,
   capturing screenshots + console as evidence. It returns a pass/fail + evidence. **Honest ceiling:**
   web mode has **no keychain/vault**, so real LLM/tool *runtime* can't be fully exercised there — for
   native-only behavior, the smoke agent verifies what it can in-browser (UI, persistence, error
   surfacing) and emits a short **desktop checklist** (`npm run tauri:dev`) for the user.
3. **Bounded auto-fix loop:** on any gate/smoke failure, spawn fix agent(s) scoped to the failing
   surface, re-integrate, re-run the gate. Cap at ~2–3 rounds; then stop and escalate to the user with
   the exact failing output.

**2f. Checkpoint.** Update `PROGRESS.md` (move the phase to Done; add a Changelog line with the
verified counts). Commit the ledger. Open/refresh a **PR for the phase**
(`& "C:\Program Files\GitHub CLI\gh.exe" pr create --base main --head <branch> …` — `gh` is not on
PATH; use the full path). **Pause and ask the user to approve before starting the next phase.**

### Step 3 — End goal
When the ledger shows **no remaining phases** and the final phase passed the code gate + agent smoke
test, report the verified end state: every gate's observed output, the smoke evidence, and the PR
links. State plainly what is verified vs. what still needs a real desktop (`tauri:dev`) run.

## Standing rules — bake these into every task & QA prompt

- **Disjoint file ownership only.** If two tasks would touch the same file, merge them or move the
  shared file to exactly one owner; the others consume it via a locked contract.
- **Never edit the four exhaustive registry tests** unless the phase genuinely adds a registry entry:
  `src/lib/canvas/__tests__/node-registry.test.ts`, `src/lib/agents/__tests__/registry.test.ts`,
  `src/lib/tools/__tests__/registry.test.ts`, `src/lib/__tests__/mcp-registry.test.ts`. If a phase DOES
  add one, the owning task updates the matching exhaustive array — and only that task.
- **Mock gotcha:** any repo/registry mock used with `new` MUST be a `class` or
  `vi.fn().mockImplementation(function(){…})` / `vi.fn(function(){…})` — **never** `vi.fn(() => ({…}))`
  (an arrow has no construct signature; `new` throws).
- **Worktree test setup:** a fresh worktree has no `node_modules`. Enable tests with a **junction**, not
  an install: `cmd /c mklink /J node_modules C:\Projects\node_modules` (the dep cache is warm; reads are
  safe across concurrent worktrees). **Never `npm install` in a worktree** — it deletes the junction and
  does a full isolated install. (`@ai-sdk/google` is a declared dep that may be absent from the local
  install; if a suite fails to transform `google.ts`, install it into the main checkout once with
  `npm install --no-save @ai-sdk/google@3.0.83` from `C:\Projects`.)
- **Keep the static export building:** `next.config.ts` sets `output: 'export'`; no Server Actions /
  Route Handlers reading the request / `cookies()`/`headers()`/`proxy` / ISR. Adding any silently breaks
  `next build` and the desktop bundle.
- **Next 16 / AI SDK v6 differ from training data** — read `C:/Projects/node_modules/next/dist/docs/`
  and the installed `ai` types before relying on an API.
- **Rust (Phases that touch `src-tauri/`):** `cargo` is not on PATH — use
  `C:\Users\chris\.rustup\toolchains\stable-x86_64-pc-windows-msvc\bin\cargo.exe`; a full Perl must be on
  PATH (`C:\Strawberry\perl\bin`) for the SQLCipher/OpenSSL build. Do NOT add `tauri` `test`/MockRuntime
  as a plain dev-dep (breaks `cargo test` on this host) — extract AppHandle-free helpers and unit-test
  those; runtime-gated tests go behind the `mock-runtime-tests` feature.
- **Tauri command registration is two places** in `src-tauri/src/lib.rs` (the `use` + the
  `generate_handler!` list) plus `pub mod` in `commands/mod.rs` — miss any and `invoke()` fails at
  runtime.

## Notes

- **Default the team size to the decomposition, not a fixed N** — as many parallel tasks as there are
  disjoint-file slices for the phase. The harness caps concurrent agents; excess queue.
- **Integration mechanic:** agents commit on their own worktree branches; you cherry-pick their SHAs.
  Don't rely on the worktrees persisting — cherry-pick promptly after QA passes.
- **Be honest in the final report:** unit/type/lint/build are fully verified; the agent smoke test is
  web-mode-bound; a true desktop end-to-end still needs the user's `tauri:dev` run. Never claim more
  than the gates prove.
