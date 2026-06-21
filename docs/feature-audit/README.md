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

## How testing maps to this environment

This is a Tauri 2 + Next.js app. The remote CI container can run the **web-mode** surface and
all JS/Rust test suites, but **not** the native desktop binary. Test methods used:

- **Unit/Component** — `npx vitest run` (Vitest + jsdom)
- **E2E (web mode)** — `npx playwright test` (Chromium vs `next dev`)
- **Types/Build/Lint** — `npx tsc --noEmit`, `npm run build`, `npx eslint .`
- **Rust** — `cargo test` in `src-tauri/`
- **Static** — code-path review for desktop-only behaviors (keychain/vault/process/fs) that
  cannot execute in CI; these are marked `Static (desktop-only)` and verified by their unit tests.
