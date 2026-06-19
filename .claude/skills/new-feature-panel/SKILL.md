---
name: new-feature-panel
description: Use when building a new UI panel or dialog in Agent Command Center — a settings/agents/chat/store/canvas feature component (e.g. an audit-log panel, a new settings section, a side drawer). Covers the 'use client' header, the hand-rolled zinc/indigo Tailwind conventions (NOT the shadcn ui/ layer), folder export style, data access, page.tsx wiring, and the test mocks.
---

# Build a feature panel / dialog

## Overview

Feature components live under `src/components/<feature>/`. The non-obvious trap: `components.json`
advertises shadcn + base-ui, **but the `ui/` layer is essentially empty** (only an unused
`button.tsx`) and the oklch design tokens in `globals.css` are only consumed by it. Every real panel
**hand-rolls raw HTML in a hardcoded zinc/indigo dark palette.** An agent that trusts `components.json`
and reaches for `@/components/ui/dialog` or `bg-card`/`text-muted-foreground` will produce a
technically-valid panel that is visually inconsistent with the whole app.

## When to use

- Adding any settings/agents/chat/store/canvas panel, dialog, drawer, or form.
- Symptoms: "add an X panel", "a settings section for Y", "a dialog to do Z", "wire a new sidebar view".

## Get these right (why this skill exists)

1. **`'use client'` is the mandatory first line** of every interactive component (App Router + hooks).
2. **Do NOT use `src/components/ui/*`** — there is no `Dialog`/`Input`/`Select`/`Card` primitive, only
   an unused `button.tsx`. **Do NOT use the oklch tokens** (`bg-card`, `border-border`, …). Hand-roll
   raw `<div>/<button>/<input>/<select>` with the palette below, copied from a sibling.
3. **Mock `@tauri-apps/plugin-sql` AND `@/lib/storage`** in the component test — the repository layer
   loads the SQL plugin, which doesn't exist in jsdom, so mocking only `@/lib/storage` isn't enough if
   anything reaches the plugin.

## The palette (copy from a sibling, e.g. `AddProviderForm.tsx`, `StorePanel.tsx`)

| Element | Classes |
|---|---|
| Full-overlay panel | `absolute inset-0 …` (e.g. `SettingsPanel`) |
| Side drawer | `absolute inset-y-0 right-0 w-80/w-96 … z-10/z-20` (e.g. `StorePanel`, `CreateAgentPanel`) |
| Container / card | `bg-[#0d0d0f]` or `bg-[#0a0a0b]`; cards `bg-white/[0.04] rounded-2xl` |
| Borders / dividers | `border-white/[0.08]` / `border-white/[0.06]` |
| Input / select | `bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors` |
| Primary button | `bg-white text-[#09090b] text-[12px] font-semibold rounded-lg px-3 py-1.5 hover:bg-zinc-100` |
| Secondary button | `text-zinc-400 hover:text-zinc-200 text-[12px] border border-white/[0.08] rounded-lg px-3 py-1.5 hover:bg-white/[0.04]` |
| Text / accent / status | `text-zinc-200`/`zinc-500`; accent `indigo-500`; status `emerald/red/yellow-400` |
| Font sizes | bracket values: `text-[13px]`, `text-[12px]`, `text-[11px]` |
| Close / back | literal glyphs `✕` / `←` with `aria-label` (not icon components) |

## Recipe

1. **Create `src/components/<feature>/<Name>.tsx`.** First line: `'use client'`.
2. **Declare `interface <Name>Props`** above the component. Panels take `onClose` (+ result callbacks
   like `onSaved`/`onCreated`); dialogs add `onCancel`; some take `open: boolean` and return `null`
   when closed (`CreateAgentPanel`).
3. **Export with the folder's style:** **default** export for `settings/`, `agents/`, `chat/`;
   **named** export for `layout/`, `canvas/`, `store/`, `approval/`. Match the sibling — the wrong
   style silently imports as `undefined`.
4. **Build markup** with raw HTML + the palette above. Multi-step dialogs use a `step` state union
   (`1 | 2`), not separate components.
5. **Data access** through repositories: `const db = await initDb(); const repo = new XRepository(db)`
   (from `@/lib/storage`). Secrets via `getSecret/setSecret/deleteSecret` from `@/lib/keychain`. Drive
   async loads with `useEffect` + a `cancelled` flag for racing fetches.
6. **Wire into `src/app/page.tsx`.** If the panel needs a new sidebar nav value, first **extend the
   `activeNav` union type** (currently `'home' | 'chat' | 'workflows' | 'store' | 'settings'`) and add
   the item to `src/components/layout/Sidebar.tsx` — `setActiveNav('audit')` is a TS error until you
   do. Then gate the render on it (e.g. `activeNav === 'audit' && <AuditLogPanel onClose={() =>
   setActiveNav('home')} />`) inside the `flex-1 relative overflow-hidden` container. Respect existing
   callback contracts — e.g. don't double-call `onClose` (a result callback like `onCreated` must not
   also close the panel).
7. **Test** (see Testing). **Verify:** `npm test`.

## Common mistakes

| Mistake | Consequence |
|---|---|
| Missing `'use client'` | Hooks break under the App Router |
| Imported `@/components/ui/dialog` etc. | No such primitive — build error / nonexistent module |
| Used oklch tokens (`bg-card`) | Valid but visually inconsistent with siblings |
| Wrong export style for the folder | Import resolves to `undefined` |
| Test mocks `@/lib/storage` but not `@tauri-apps/plugin-sql` | Component fails to load in jsdom |
| Double-called `onClose` after a result callback | Panel closes twice / state bug |

## Testing

Vitest + jsdom + Testing Library. Mock all Tauri/storage/keychain deps at module level — use
`vi.hoisted()` for shared mock fns referenced in `vi.mock` factories. Query by visible text/role/
placeholder (`getByText`, `getByRole`, `getByPlaceholderText`, `getByLabelText`), assert callbacks with
`toHaveBeenCalledWith`, wrap post-async assertions in `waitFor`. `beforeEach(() => vi.clearAllMocks())`.
Templates: `src/components/settings/__tests__/SettingsPanel.test.tsx` (hoisted mocks, stubbed child
panels) and `src/components/agents/__tests__/CreateAgentPanel.test.tsx` (mocks `@tauri-apps/plugin-sql`
+ `@/lib/storage`).
