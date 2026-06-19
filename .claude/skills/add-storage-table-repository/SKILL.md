---
name: add-storage-table-repository
description: Use when persisting a new entity to SQLite in Agent Command Center — adding a new table and its repository (e.g. workflows, shared_memory, a settings table). Covers the migrations-as-constants schema, foreign-key migration ordering, the hand-written repository shape, the storage barrel re-export, and the repository test style.
---

# Add a storage table + repository

## Overview

Storage is **migrations-as-constants** (no ORM, no migration framework): each table is a
`CREATE TABLE IF NOT EXISTS` string constant in `src/lib/storage/schema.ts`, listed in the ordered
`ALL_MIGRATIONS` array that `initDb()` runs on startup. Each table gets one **hand-written repository
class** under `src/lib/storage/repositories/`, re-exported from `src/lib/storage/index.ts`. The shape
is rigid and copy-from-neighbor — `src/lib/storage/repositories/agents.ts` is the canonical template
(its module JSDoc says so; it exercises JSON columns and method docs), and `mcps.ts` shows the boolean
`0/1` pattern. (`models.ts` is simpler — no JSON or boolean columns — but its test `models.test.ts` is
the cleanest *test* template, see Testing.)

## When to use

- Persisting a new entity / adding a new table + CRUD.
- Symptoms: "store X in the database", "add a `workflows` table", "I need a repository for Y".

## Recipe

1. **Add the table** to `src/lib/storage/schema.ts`: `export const CREATE_<TABLE> = `CREATE TABLE IF
   NOT EXISTS <table> ( … )``. Column conventions:
   - `id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16))))`
   - `created_at INTEGER NOT NULL DEFAULT (unixepoch())`
   - JSON array/object columns → `TEXT NOT NULL DEFAULT '[]'` (or `'{}'`)
   - booleans → `INTEGER NOT NULL DEFAULT 0/1`
   - enums → `TEXT NOT NULL CHECK(col IN ('a','b'))`
   - owned rows → `<parent>_id TEXT NOT NULL REFERENCES <parent>(id) ON DELETE CASCADE`
2. **Append to `ALL_MIGRATIONS`** at the bottom of `schema.ts`. **Order is load-bearing for foreign
   keys** — a table referenced by an FK must appear *before* the table that references it. Append new
   FK-child tables after their parents; **never reorder existing entries.**
3. **Create `src/lib/storage/repositories/<table>.ts`** (copy `agents.ts` — the canonical template):
   - Open with a JSDoc module comment; non-canonical repos add `See {@link AgentRepository} for the
     pattern.`
   - `export interface <Name>Row` — camelCase fields; JSON columns typed as arrays/objects; nullable
     columns as `T | null`; include `createdAt: number`.
   - A **non-exported** `interface <Name>Insert` — required fields, optionals with `?`.
   - `export class <Name>Repository { constructor(private db: Db) {} … }`:
     - `async create(data): Promise<string>` — `const id = crypto.randomUUID()`; `await
       this.db.execute('INSERT INTO <table> (…) VALUES ($1, $2, …)', [id, …])`. `JSON.stringify`
       JSON columns, map booleans `x ? 1 : 0`, coalesce optionals `data.x ?? null`. Return `id`.
     - `async findAll(): Promise<<Name>Row[]>` — `const rows = await this.db.select<Record<string,
       unknown>[]>('SELECT * FROM <table>'); return rows.map(this.deserialize)`.
     - `async findById(id): Promise<<Name>Row | null>` — `… WHERE id = $1`, `[id]`; `return rows[0] ?
       this.deserialize(rows[0]) : null`.
     - `async delete(id): Promise<void>` and any custom finders/updaters as needed.
     - `private deserialize(row: Record<string, unknown>): <Name>Row` — cast each column,
       `JSON.parse` JSON columns, coerce booleans `(row.x as number) === 1`.
4. **Re-export** from `src/lib/storage/index.ts`:
   `export { <Name>Repository } from './repositories/<table>'` and
   `export type { <Name>Row } from './repositories/<table>'`.
5. **Write the test** `src/lib/storage/repositories/__tests__/<table>.test.ts` (see Testing).
6. **Verify:** `npm test`. (`src/lib/storage/__tests__/db.test.ts` asserts `execute` is called
   `ALL_MIGRATIONS.length` times and stays green automatically when you append one migration.)

Callers: `import { initDb, <Name>Repository } from '@/lib/storage'; const db = await initDb(); const
repo = new <Name>Repository(db)`.

## Conventions

- DB rows are snake_case, `*Row` interfaces camelCase — `deserialize()` is the only translation point.
- Ids are generated in JS (`crypto.randomUUID()`), not by the SQL default — the default is a fallback
  the repo path never exercises.
- Positional `$1..$n` placeholders (not `?`). Reads use `db.select`, writes use `db.execute`.
- `created_at` is never set by the repo — the SQL default fills it.
- **append-only tables** (like `audit_log`) are the exception: integer autoincrement pk, no
  id-in-JS, no update/delete, a custom `*Entry` name instead of `*Row`.

## Common mistakes

| Mistake | Consequence |
|---|---|
| Migration placed before its FK parent | FK references a not-yet-created table |
| Forgot the `index.ts` barrel re-export | Callers can't import the repository/Row type |
| Copied the legacy `src/lib/__tests__/storage.test.ts` style | Loose test; use the newer per-param style |
| `deserialize` uses `this` but passed bare to `.map` | `this` is undefined; bind it or use an arrow |
| Forgot `JSON.stringify`/`JSON.parse` symmetry | Strings stored/returned instead of arrays/objects |

## Testing

Vitest, colocated, **newer thorough style** — template: `src/lib/storage/repositories/__tests__/models.test.ts`
(NOT the legacy `src/lib/__tests__/storage.test.ts`). Hoist a mock db:
`const { mockDb } = vi.hoisted(() => ({ mockDb: { execute: vi.fn(async () => ({ rowsAffected: 1 })),
select: vi.fn(async () => []) } }))`; `vi.mock('@tauri-apps/plugin-sql', () => ({ default: { load:
vi.fn(async () => mockDb) } }))` and `vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async ()
=> null) }))`. `function makeRepo() { return new <Name>Repository(mockDb as never) }`;
`beforeEach(() => vi.clearAllMocks())`. Assert `mockDb.execute.mock.calls[0]` as `[sql, params]` —
`sql` with `toContain('INSERT INTO <table>')`, `params` with `toEqual([...])` (JSON.stringify'd JSON
cols, 0/1 booleans). For reads, `mockDb.select.mockResolvedValueOnce([{ snake_case row }])` then assert
the camelCase result with `toEqual`. Cover: create (all fields + omitted optionals), findAll mapping,
findById present, findById null on `[]`, delete, and custom methods.
