# Feature Audit — User-Story Catalog & Test Tracker

`user-stories.csv` is the **single canonical spreadsheet** tracking every feature in
Agent Command Center as a user story with its expected behavior (derived from the code),
plus its status through a four-phase audit.

## The four-phase loop (per the audit goal)

1. **Catalog** — one user story per feature with expected behavior + source files. (`Status = Catalogued`)
2. **Test** — exercise every user story; document errors. (`Status = Pass` / `Fail`; details in *Test Result / Errors*)
3. **Fix** — repair every logistical or UX error found. (`Fix Applied` filled in)
4. **Re-test** — re-verify every user behavior post-fix. (`Retest Result` filled in; `Status = Verified`)

## Columns

| Column | Meaning |
|---|---|
| ID | Stable story id (US-NNN) |
| Area | Subsystem grouping |
| Feature | Short feature name |
| User Story | As-a / I-want phrasing |
| Expected Behavior | What the code is supposed to do (the test oracle) |
| Source Files | Where the behavior lives |
| Status | Catalogued → Pass/Fail → Verified |
| Test Method | How it was verified (unit/e2e/static/manual) |
| Test Result / Errors | Observed result + any error documented |
| Fix Applied | The fix made in Phase 3 |
| Retest Result | Phase-4 re-verification result |

## Audit results (this pass)

**Baseline gates:** `tsc` clean · Vitest **554 passing / 95 files** · `npm run build` static-export OK ·
Playwright web e2e **4/4** · `cargo test` **29/32** (the 3 keychain tests fail only because this
headless CI container has no Secret Service/D-Bus — environment, not code).

**6 logistical/UX bugs found in Phase 2 and fixed in Phase 3 (all re-verified in Phase 4):**

| Story | Bug | Fix |
|---|---|---|
| US-002 | Sidebar **Chat** nav was a dead-end (highlighted, opened nothing) | `handleNavigate` resumes the most-recent/first agent chat, or opens Create Agent when none exist |
| US-009 | StatusBar **LLM calls / cost / tools** were hardcoded `0` | Wired to real persisted state (tools count, assistant turns, summed session cost) |
| US-047 | **Add Provider** could save an empty API key | Save disabled until a non-empty key (Ollama exempt) |
| US-050 | Configured **Google** provider showed raw id `google` | Added `google → "Google Gemini"` to the third display-name map |
| US-059 | Custom **MCP** added via footer was saved but never rendered | Footer routes through `useInstalledMcps.addCustom`; custom rows now render |
| US-070 | **Run workflow** modal leaked the previous run's input | Start input cleared on every Run/Cancel/close path |

**Known, out-of-scope items (documented, not fixed):** web-mode `invoke` console noise (desktop is the
real target; web is intentionally degraded) and the codebase-wide `react-hooks/set-state-in-effect`
lint hints (code-health, not user-facing behavior — left untouched to avoid broad regression risk).

## How testing maps to this environment

This is a Tauri 2 + Next.js app. The remote CI container can run the **web-mode** surface and
all JS/Rust test suites, but **not** the native desktop binary. Test methods used:

- **Unit/Component** — `npx vitest run` (Vitest + jsdom)
- **E2E (web mode)** — `npx playwright test` (Chromium vs `next dev`)
- **Types/Build/Lint** — `npx tsc --noEmit`, `npm run build`, `npx eslint .`
- **Rust** — `cargo test` in `src-tauri/`
- **Static** — code-path review for desktop-only behaviors (keychain/vault/process/fs) that
  cannot execute in CI; these are marked `Static (desktop-only)` and verified by their unit tests.
