# Workflow Builder — W1 (Core Engine + Editor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the core of the Workflow Builder — persist/edit a graph of agent/tool nodes and run it in-process (sequential + parallel + join) with live per-node status — per the approved spec [`2026-06-19-workflow-builder-design.md`](../specs/2026-06-19-workflow-builder-design.md). Control flow (`conditional`/`loop`/`transform`) is W2; this is W1.

**Architecture:** A `WorkflowNodeDef` registry (implement-an-interface-and-register, mirroring `NODE_REGISTRY`/`TOOL_REGISTRY`); typed ports + edges carrying JSON values; an in-process **readiness** engine (a node runs once all its connected inputs have values; independent ready nodes run concurrently); two new SQLite tables; `workflow:*` event-bus events + a consumer hook; and a dedicated React Flow editor wired under the existing **Workflows** nav.

**Tech Stack:** Next.js 16 (static export, client SPA) · React · `reactflow` (already a dep) · Vitest/jsdom · Tauri SQLite (via `initDb`).

## Global Constraints

- **Static export must keep building** (`npm run build` → `out/`): no Server Actions / route handlers / `cookies`/`headers`; engine runs in-process; native effects only through existing Tauri commands. **Do not** statically import Node-only modules into the client graph (the Phase-5 `cross-spawn` lesson).
- **Storage:** migrations-as-constants in `schema.ts`; **`workflows` before `workflow_runs`** in `ALL_MIGRATIONS` (FK order). One hand-written repo per table; snake_case columns ↔ camelCase `*Row`; ids via `crypto.randomUUID()`; positional `$1..$n` params; JSON columns `JSON.stringify`/`parse`d; re-export class + `*Row` from `src/lib/storage/index.ts`.
- **UI:** every interactive component starts with `'use client'` and declares a `<Name>Props` interface; hand-rolled zinc/indigo palette (`bg-[#0d0d0f]`, `border-white/[0.08]`, `focus:border-indigo-500/50`, bracket sizes like `text-[13px]`) — **not** `components/ui/*`. New `workflows/` folder: use **named** exports (match `canvas/`/`store/` siblings).
- **Events:** add new variants to the `AppEvent` union in `src/lib/interfaces/event-bus.ts` — that union entry is the only registration step. `action` strings are namespaced (`workflow:...`).
- **Tests:** Vitest, co-located `__tests__/`, `import { describe, it, expect, vi } from 'vitest'`. Mock the Tauri boundary (`@tauri-apps/api/core`, `@tauri-apps/plugin-sql`) and `@/lib/event-bus`. **Mock-with-`new` must be a `class` or `vi.fn(function(){})`** — never an arrow.
- **Registry tests:** do not touch the existing four (`node-registry`, `agents/registry`, `tools/registry`, `mcp-registry`). W1 **adds** a new exhaustive registry test for `WORKFLOW_NODE_REGISTRY`.
- **Run all checks from the worktree**, not the main checkout. Reuse the `node_modules` junction; never `npm install` in a worktree.

---

## File Structure

**Contracts / logic (no React):**
- `src/lib/interfaces/workflow-node.ts` *(new)* — `WorkflowNodeDef`, `PortDef`, `PortType`, `NodeConfig`, `NodeRunStatus`, `WorkflowNodeContext`.
- `src/lib/interfaces/index.ts` *(modify)* — barrel-export the new types.
- `src/lib/interfaces/event-bus.ts` *(modify)* — add `workflow:*` events to `AppEvent`.
- `src/lib/workflows/graph.ts` *(new)* — `WorkflowGraph`/`WorkflowNode`/`WorkflowEdge` normalized types + `normalizeGraph(nodes, edges)` + `validateGraph(graph)`.
- `src/lib/workflows/engine.ts` *(new)* — `runWorkflow(graph, input, opts)`.
- `src/lib/workflows/node-registry.ts` *(new)* — `WORKFLOW_NODE_REGISTRY`, `registerWorkflowNode`, `listWorkflowNodes`; imports + registers the five built-in defs.
- `src/lib/workflows/nodes/{start,agent,tool,output,join}.ts` *(new, one per file)* — the five `WorkflowNodeDef`s.
- `src/lib/storage/schema.ts` *(modify)* — `CREATE_WORKFLOWS`, `CREATE_WORKFLOW_RUNS`, `ALL_MIGRATIONS`.
- `src/lib/storage/repositories/{workflows,workflow-runs}.ts` *(new)* — repos.
- `src/lib/storage/index.ts` *(modify)* — re-exports.
- `src/hooks/useWorkflowRun.ts` *(new)* — live run state from the bus.

**UI (React):**
- `src/components/workflows/WorkflowNodeCard.tsx` *(new)* — generic React Flow card: label + input/output `Handle`s from the def's ports + live status ring.
- `src/components/workflows/NodePalette.tsx` *(new)* — add-node list from the registry.
- `src/components/workflows/NodeConfigRail.tsx` *(new)* — renders the selected def's `ConfigPanel`.
- `src/components/workflows/RunModal.tsx` *(new)* — Start-input entry + Run.
- `src/components/workflows/WorkflowEditor.tsx` *(new)* — the React Flow canvas tying it together.
- `src/components/workflows/WorkflowsPanel.tsx` *(new)* — list/new/open + hosts the editor.
- `src/app/page.tsx` *(modify)* — render `WorkflowsPanel` under `activeNav === 'workflows'`.

**Parallel batches** (disjoint files; producers first):
- **Batch 1 (roots, parallel):** T1 types+barrel · T2 events · T3 storage (schema+repos+barrel) · T4 graph.
- **Batch 2 (parallel, dep B1):** T5 node defs (start/agent/tool/output/join) · T6 engine · T7 useWorkflowRun hook.
- **Batch 3 (dep B2):** T8 node-registry + exhaustive test.
- **Batch 4 (UI, parallel, dep B1–B3):** T9 WorkflowNodeCard · T10 NodePalette · T11 NodeConfigRail · T12 RunModal.
- **Batch 5 (integration):** T13 WorkflowEditor · T14 WorkflowsPanel + page.tsx wiring.

---

## Task 1: Workflow node contract + barrel

**Files:**
- Create: `src/lib/interfaces/workflow-node.ts`
- Modify: `src/lib/interfaces/index.ts`
- Test: none (types only; exercised by later tasks)

**Interfaces:**
- Produces (LOCKED — every other task imports these from `@/lib/interfaces`):

```ts
import type { ComponentType } from 'react'
import type { PermissionScope } from './agent-provider'

export type PortType = 'text' | 'json' | 'any'
export interface PortDef { name: string; label: string; type: PortType }
export type NodeConfig = Record<string, unknown>
export type NodeRunStatus = 'pending' | 'running' | 'done' | 'error'

export interface WorkflowNodeContext {
  inputs: Record<string, unknown>
  nodeId: string
  runId: string
  permissionScope: PermissionScope
  report: (status: NodeRunStatus, detail?: string) => void
}

export interface WorkflowNodeDef<TConfig extends NodeConfig = NodeConfig> {
  readonly type: string
  readonly category: 'io' | 'compute' | 'control'
  readonly label: string
  readonly icon: string
  ports(config: TConfig): { inputs: PortDef[]; outputs: PortDef[] }
  defaultConfig(): TConfig
  ConfigPanel: ComponentType<{ config: TConfig; onChange: (c: TConfig) => void }>
  execute?(ctx: WorkflowNodeContext, config: TConfig): Promise<Record<string, unknown>>
}
```

- [ ] **Step 1: Create `src/lib/interfaces/workflow-node.ts`** with the JSDoc module header (mirror `canvas-node.ts`'s style) and exactly the types above.

- [ ] **Step 2: Barrel-export from `src/lib/interfaces/index.ts`.** That file is `export type *` per-module. Add a line mirroring the existing ones:

```ts
export type * from './workflow-node'
```

- [ ] **Step 3: Verify it compiles.** Run: `npx tsc --noEmit` — Expected: exit 0 (no consumers yet).

- [ ] **Step 4: Commit.**

```bash
git add src/lib/interfaces/workflow-node.ts src/lib/interfaces/index.ts
git commit -m "feat(workflow-w1): WorkflowNodeDef contract + barrel"
```

---

## Task 2: workflow:* events

**Files:**
- Modify: `src/lib/interfaces/event-bus.ts`
- Test: `src/lib/__tests__/event-bus.test.ts` (extend if present; else add a focused test)

**Interfaces:**
- Produces (LOCKED):

```ts
export interface WorkflowRunStartedEvent { type: 'workflow:run-started'; runId: string; workflowId: string; timestamp: number }
export interface WorkflowNodeStatusEvent { type: 'workflow:node-status'; runId: string; nodeId: string; status: 'pending'|'running'|'done'|'error'; detail?: string; timestamp: number }
export interface WorkflowRunFinishedEvent { type: 'workflow:run-finished'; runId: string; status: 'done'|'error'; result?: unknown; timestamp: number }
```

- [ ] **Step 1: Write the failing test** `src/lib/__tests__/event-bus.test.ts` (add a case if the file exists):

```ts
import { describe, it, expect, vi } from 'vitest'
import { createEventBus } from '@/lib/event-bus'

describe('event bus — workflow events', () => {
  it('delivers a workflow:node-status event to its listener', () => {
    const bus = createEventBus()
    const handler = vi.fn()
    bus.on('workflow:node-status', handler)
    bus.emit({ type: 'workflow:node-status', runId: 'r1', nodeId: 'n1', status: 'running', timestamp: 1 })
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'workflow:node-status', runId: 'r1', nodeId: 'n1', status: 'running' }),
    )
  })
})
```

- [ ] **Step 2: Run it, expect FAIL** (`workflow:node-status` not in the union → TS error / no delivery). Run: `npx vitest run src/lib/__tests__/event-bus.test.ts`

- [ ] **Step 3: Add the three interfaces** to `event-bus.ts` and extend the `AppEvent` union:

```ts
export type AppEvent =
  | AgentStatusChangedEvent
  | AgentActionEvent
  | AgentApprovalRequestedEvent
  | AgentApprovalResolvedEvent
  | CanvasLayoutChangedEvent
  | WorkflowRunStartedEvent
  | WorkflowNodeStatusEvent
  | WorkflowRunFinishedEvent
```

- [ ] **Step 4: Run the test, expect PASS.** Run: `npx vitest run src/lib/__tests__/event-bus.test.ts`

- [ ] **Step 5: Commit.**

```bash
git add src/lib/interfaces/event-bus.ts src/lib/__tests__/event-bus.test.ts
git commit -m "feat(workflow-w1): workflow:* app events"
```

---

## Task 3: Storage — workflows + workflow_runs

**Files:**
- Modify: `src/lib/storage/schema.ts`
- Create: `src/lib/storage/repositories/workflows.ts`, `src/lib/storage/repositories/workflow-runs.ts`
- Modify: `src/lib/storage/index.ts`
- Test: `src/lib/storage/repositories/__tests__/workflows.test.ts`, `.../workflow-runs.test.ts`

**Interfaces:**
- Produces (LOCKED):

```ts
export interface WorkflowRow { id: string; name: string; description: string; nodes: unknown[]; edges: unknown[]; createdAt: number; updatedAt: number }
class WorkflowRepository {
  create(d: { name: string; description?: string; nodes?: unknown[]; edges?: unknown[] }): Promise<string>
  findAll(): Promise<WorkflowRow[]>
  findById(id: string): Promise<WorkflowRow | null>
  update(id: string, patch: { name?: string; description?: string; nodes?: unknown[]; edges?: unknown[] }): Promise<void> // sets updated_at=unixepoch()
  delete(id: string): Promise<void>
}
export interface WorkflowRunRow { id: string; workflowId: string; status: 'running'|'done'|'error'; input: unknown; result: unknown; nodeStates: Record<string, unknown>; startedAt: number; finishedAt: number | null }
class WorkflowRunRepository {
  create(d: { workflowId: string; input?: unknown }): Promise<string>            // status='running', node_states='{}'
  finish(id: string, d: { status: 'done'|'error'; result?: unknown; nodeStates?: Record<string, unknown> }): Promise<void> // sets finished_at
  findByWorkflowId(workflowId: string): Promise<WorkflowRunRow[]>                // newest first
}
```

- [ ] **Step 1: Add schema constants** to `schema.ts` and the migration list (order: workflows then workflow_runs):

```ts
export const CREATE_WORKFLOWS = `
  CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    nodes TEXT NOT NULL DEFAULT '[]',
    edges TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
`
export const CREATE_WORKFLOW_RUNS = `
  CREATE TABLE IF NOT EXISTS workflow_runs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running','done','error')),
    input TEXT NOT NULL DEFAULT 'null',
    result TEXT NOT NULL DEFAULT 'null',
    node_states TEXT NOT NULL DEFAULT '{}',
    started_at INTEGER NOT NULL DEFAULT (unixepoch()),
    finished_at INTEGER
  )
`
```
Append both to `ALL_MIGRATIONS` (workflows first).

- [ ] **Step 2: Write the failing repo test** `__tests__/workflows.test.ts` (mirror `mcps.test.ts`'s mock-`db` style — assert exact SQL + params):

```ts
import { describe, it, expect, vi } from 'vitest'
import { WorkflowRepository } from '@/lib/storage/repositories/workflows'

function mockDb() { return { execute: vi.fn(async () => ({ rowsAffected: 1 })), select: vi.fn(async () => []) } }

describe('WorkflowRepository', () => {
  it('create inserts name/description/nodes/edges and returns a uuid', async () => {
    const db = mockDb()
    const repo = new WorkflowRepository(db as never)
    const id = await repo.create({ name: 'WF', nodes: [{ id: 'n' }], edges: [] })
    expect(typeof id).toBe('string')
    const [sql, params] = db.execute.mock.calls[0]
    expect(sql).toContain('INSERT INTO workflows')
    expect(params).toEqual([id, 'WF', '', JSON.stringify([{ id: 'n' }]), JSON.stringify([])])
  })

  it('update writes only provided fields plus updated_at and id last', async () => {
    const db = mockDb()
    await new WorkflowRepository(db as never).update('wf1', { name: 'X' })
    const [sql, params] = db.execute.mock.calls[0]
    expect(sql).toMatch(/UPDATE workflows SET name = \$1, updated_at = unixepoch\(\) WHERE id = \$2/)
    expect(params).toEqual(['X', 'wf1'])
  })

  it('findById deserializes JSON columns', async () => {
    const db = mockDb()
    db.select = vi.fn(async () => [{ id: 'wf1', name: 'WF', description: '', nodes: '[{"id":"n"}]', edges: '[]', created_at: 1, updated_at: 2 }])
    const row = await new WorkflowRepository(db as never).findById('wf1')
    expect(row).toMatchObject({ id: 'wf1', nodes: [{ id: 'n' }], edges: [], createdAt: 1, updatedAt: 2 })
  })
})
```

- [ ] **Step 3: Run it, expect FAIL.** Run: `npx vitest run src/lib/storage/repositories/__tests__/workflows.test.ts`

- [ ] **Step 4: Implement `workflows.ts`** (mirror `mcps.ts` exactly; `update` builds a dynamic SET in fixed column order `name, description, nodes, edges`, always appending `updated_at = unixepoch()`, with `$1..$n` then id last; no-op if patch empty):

```ts
import type { Db } from '../db'

export interface WorkflowRow {
  id: string; name: string; description: string
  nodes: unknown[]; edges: unknown[]; createdAt: number; updatedAt: number
}

export class WorkflowRepository {
  constructor(private db: Db) {}

  async create(data: { name: string; description?: string; nodes?: unknown[]; edges?: unknown[] }): Promise<string> {
    const id = crypto.randomUUID()
    await this.db.execute(
      `INSERT INTO workflows (id, name, description, nodes, edges) VALUES ($1, $2, $3, $4, $5)`,
      [id, data.name, data.description ?? '', JSON.stringify(data.nodes ?? []), JSON.stringify(data.edges ?? [])],
    )
    return id
  }

  async findAll(): Promise<WorkflowRow[]> {
    const rows = await this.db.select<Record<string, unknown>[]>('SELECT * FROM workflows ORDER BY updated_at DESC')
    return rows.map(this.deserialize)
  }

  async findById(id: string): Promise<WorkflowRow | null> {
    const rows = await this.db.select<Record<string, unknown>[]>('SELECT * FROM workflows WHERE id = $1', [id])
    return rows[0] ? this.deserialize(rows[0]) : null
  }

  async update(id: string, patch: { name?: string; description?: string; nodes?: unknown[]; edges?: unknown[] }): Promise<void> {
    const sets: string[] = []
    const params: unknown[] = []
    let i = 1
    if (patch.name !== undefined) { sets.push(`name = $${i++}`); params.push(patch.name) }
    if (patch.description !== undefined) { sets.push(`description = $${i++}`); params.push(patch.description) }
    if (patch.nodes !== undefined) { sets.push(`nodes = $${i++}`); params.push(JSON.stringify(patch.nodes)) }
    if (patch.edges !== undefined) { sets.push(`edges = $${i++}`); params.push(JSON.stringify(patch.edges)) }
    if (sets.length === 0) return
    params.push(id)
    await this.db.execute(`UPDATE workflows SET ${sets.join(', ')}, updated_at = unixepoch() WHERE id = $${i}`, params)
  }

  async delete(id: string): Promise<void> {
    await this.db.execute('DELETE FROM workflows WHERE id = $1', [id])
  }

  private deserialize(row: Record<string, unknown>): WorkflowRow {
    return {
      id: row.id as string, name: row.name as string, description: row.description as string,
      nodes: JSON.parse(row.nodes as string), edges: JSON.parse(row.edges as string),
      createdAt: row.created_at as number, updatedAt: row.updated_at as number,
    }
  }
}
```

- [ ] **Step 5: Implement `workflow-runs.ts`** analogously:

```ts
import type { Db } from '../db'

export interface WorkflowRunRow {
  id: string; workflowId: string; status: 'running' | 'done' | 'error'
  input: unknown; result: unknown; nodeStates: Record<string, unknown>
  startedAt: number; finishedAt: number | null
}

export class WorkflowRunRepository {
  constructor(private db: Db) {}

  async create(data: { workflowId: string; input?: unknown }): Promise<string> {
    const id = crypto.randomUUID()
    await this.db.execute(
      `INSERT INTO workflow_runs (id, workflow_id, input) VALUES ($1, $2, $3)`,
      [id, data.workflowId, JSON.stringify(data.input ?? null)],
    )
    return id
  }

  async finish(id: string, data: { status: 'done' | 'error'; result?: unknown; nodeStates?: Record<string, unknown> }): Promise<void> {
    await this.db.execute(
      `UPDATE workflow_runs SET status = $1, result = $2, node_states = $3, finished_at = unixepoch() WHERE id = $4`,
      [data.status, JSON.stringify(data.result ?? null), JSON.stringify(data.nodeStates ?? {}), id],
    )
  }

  async findByWorkflowId(workflowId: string): Promise<WorkflowRunRow[]> {
    const rows = await this.db.select<Record<string, unknown>[]>(
      'SELECT * FROM workflow_runs WHERE workflow_id = $1 ORDER BY started_at DESC', [workflowId],
    )
    return rows.map(this.deserialize)
  }

  private deserialize(row: Record<string, unknown>): WorkflowRunRow {
    return {
      id: row.id as string, workflowId: row.workflow_id as string, status: row.status as WorkflowRunRow['status'],
      input: JSON.parse(row.input as string), result: JSON.parse(row.result as string),
      nodeStates: JSON.parse(row.node_states as string),
      startedAt: row.started_at as number, finishedAt: (row.finished_at as number | null) ?? null,
    }
  }
}
```

- [ ] **Step 6: Re-export** both from `src/lib/storage/index.ts`:

```ts
export { WorkflowRepository } from './repositories/workflows'
export type { WorkflowRow } from './repositories/workflows'
export { WorkflowRunRepository } from './repositories/workflow-runs'
export type { WorkflowRunRow } from './repositories/workflow-runs'
```

- [ ] **Step 7: Add a `workflow-runs.test.ts`** asserting `create` SQL/params and `finish` SQL/params (mirror Step 2 style).

- [ ] **Step 8: Run both, expect PASS.** Run: `npx vitest run src/lib/storage/repositories/__tests__/workflows.test.ts src/lib/storage/repositories/__tests__/workflow-runs.test.ts`

- [ ] **Step 9: Commit.**

```bash
git add src/lib/storage/schema.ts src/lib/storage/repositories/workflows.ts src/lib/storage/repositories/workflow-runs.ts src/lib/storage/index.ts src/lib/storage/repositories/__tests__/workflows.test.ts src/lib/storage/repositories/__tests__/workflow-runs.test.ts
git commit -m "feat(workflow-w1): workflows + workflow_runs tables and repositories"
```

---

## Task 4: Graph types + validation

**Files:**
- Create: `src/lib/workflows/graph.ts`
- Test: `src/lib/workflows/__tests__/graph.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (LOCKED):

```ts
export interface WorkflowNode { id: string; type: string; config: NodeConfig }
export interface WorkflowEdge { id: string; source: string; sourcePort: string; target: string; targetPort: string }
export interface WorkflowGraph { nodes: WorkflowNode[]; edges: WorkflowEdge[] }
// Build a normalized graph from React Flow rows (node.data carries {type, config}; edge sourceHandle/targetHandle carry port names).
export function normalizeGraph(rfNodes: Array<{ id: string; data: { type: string; config?: NodeConfig } }>, rfEdges: Array<{ id: string; source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null }>): WorkflowGraph
// Throws Error with a clear message if invalid; returns void if OK.
export function validateGraph(graph: WorkflowGraph): void
```
Validation rules: exactly one node of type `start`; at least one `output`; every edge references existing nodes + ports (`sourceHandle`/`targetHandle` non-null); the directed graph (ignoring future loop bodies) is acyclic.

- [ ] **Step 1: Write failing tests** covering: `normalizeGraph` maps `sourceHandle`→`sourcePort`; `validateGraph` throws on zero/multiple `start`, on a missing-node edge, and on a cycle; passes on a valid `start→agent→output`.

```ts
import { describe, it, expect } from 'vitest'
import { normalizeGraph, validateGraph } from '@/lib/workflows/graph'

const g = (nodes: any[], edges: any[] = []) => ({ nodes, edges })

describe('workflow graph', () => {
  it('normalizes RF rows into typed graph', () => {
    const out = normalizeGraph(
      [{ id: 'a', data: { type: 'start', config: {} } }],
      [{ id: 'e', source: 'a', target: 'b', sourceHandle: 'out', targetHandle: 'in' }],
    )
    expect(out.nodes[0]).toEqual({ id: 'a', type: 'start', config: {} })
    expect(out.edges[0]).toEqual({ id: 'e', source: 'a', sourcePort: 'out', target: 'b', targetPort: 'in' })
  })

  it('requires exactly one start', () => {
    expect(() => validateGraph(g([{ id: 'o', type: 'output', config: {} }]))).toThrow(/exactly one start/i)
  })

  it('rejects a cycle', () => {
    const graph = g(
      [{ id: 's', type: 'start', config: {} }, { id: 'o', type: 'output', config: {} }],
      [{ id: 'e1', source: 's', sourcePort: 'o', target: 'o', targetPort: 'i' }, { id: 'e2', source: 'o', sourcePort: 'o', target: 's', targetPort: 'i' }],
    )
    expect(() => validateGraph(graph)).toThrow(/cycle/i)
  })

  it('accepts a valid linear graph', () => {
    const graph = g(
      [{ id: 's', type: 'start', config: {} }, { id: 'o', type: 'output', config: {} }],
      [{ id: 'e1', source: 's', sourcePort: 'out', target: 'o', targetPort: 'in' }],
    )
    expect(() => validateGraph(graph)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run, expect FAIL.** Run: `npx vitest run src/lib/workflows/__tests__/graph.test.ts`
- [ ] **Step 3: Implement `graph.ts`** — `normalizeGraph` maps fields (default missing handles to `''`); `validateGraph` checks start-count, output presence, edge endpoint existence, and runs a DFS cycle check.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit.** `git add src/lib/workflows/graph.ts src/lib/workflows/__tests__/graph.test.ts && git commit -m "feat(workflow-w1): graph normalization + validation"`

---

## Task 5: Built-in node defs (start, agent, tool, output, join)

**Files:**
- Create: `src/lib/workflows/nodes/start.ts`, `agent.ts`, `tool.ts`, `output.ts`, `join.ts`
- Test: `src/lib/workflows/nodes/__tests__/nodes.test.ts`

**Interfaces:**
- Consumes: `WorkflowNodeDef`, `WorkflowNodeContext`, `PortDef` from `@/lib/interfaces` (T1); for `agent`/`tool` execute: `AGENT_REGISTRY`+`resolveAgentRuntimeType` (`@/lib/agents/registry`), `SessionRepository`/`initDb` (`@/lib/storage`), `TOOL_REGISTRY` (`@/lib/tools/registry`), `getMCPRegistry` (`@/lib/mcp/registry`).
- Produces (LOCKED — node `type` keys): `start`, `agent`, `tool`, `output`, `join`. Each exports a `const <Name>NodeDef: WorkflowNodeDef`.

Behaviors:
- `start` — `ports`: outputs `[{name:'value',label:'Value',type:'any'}]`, no inputs. `execute` returns `{ value: ctx.inputs.__runInput }` (the run input is injected by the engine on the start node's `__runInput` pseudo-input; see engine). `ConfigPanel`: a muted "Provided at run time." note.
- `output` — inputs `[{name:'value',label:'Value',type:'any'}]`, no outputs. `execute` returns `{}` (engine reads its inputs as the run result). `ConfigPanel`: muted note.
- `join` — `ports(config)`: inputs = `config.count` (default 2) ports `in1..inN`, output `[{name:'value',type:'json'}]`. `execute` returns `{ value: ctx.inputs }` (all inputs as an object). `ConfigPanel`: a number input bound to `config.count`.
- `agent` — config `{ agentId?: string; promptTemplate: string }`. inputs `[{name:'input',type:'any'}]`, outputs `[{name:'text',type:'text'},{name:'result',type:'json'}]`. `execute`: resolve `config.agentId` → provider via `AGENT_REGISTRY.get(resolveAgentRuntimeType(agentRow.type))`; create a session (`SessionRepository.create`); build the prompt by replacing `{{input}}` in `promptTemplate` with `String(ctx.inputs.input ?? '')`; iterate `provider.run(session, prompt)`, accumulating `text-delta`s; `report('running')`/`report('done')`; return `{ text: accumulated, result: accumulated }`. `ConfigPanel`: agent `<select>` (from `AgentRepository.findAll`) + a prompt `<textarea>`.
- `tool` — config `{ toolName?: string; argsTemplate: string }`. input `[{name:'input',type:'any'}]`, output `[{name:'result',type:'json'}]`. `execute`: `TOOL_REGISTRY.get(config.toolName)`; parse `argsTemplate` as JSON (with `{{input}}` substituted), call `def.execute(args, { agentId:'workflow', sessionId: ctx.runId, permissionScope: ctx.permissionScope })`; return `{ result }`. `ConfigPanel`: tool `<select>` (from `listBuiltInTools()`) + an args `<textarea>`.

- [ ] **Step 1: Write failing tests** for the pure-ish nodes (`start`/`output`/`join` `ports` + `execute`), mocking nothing; and `agent`/`tool` `execute` with `@/lib/agents/registry`, `@/lib/storage`, `@/lib/tools/registry` mocked (class/`function` mocks). Example:

```ts
import { describe, it, expect, vi } from 'vitest'
import { JoinNodeDef } from '@/lib/workflows/nodes/join'
import { StartNodeDef } from '@/lib/workflows/nodes/start'

const ctx = (inputs: Record<string, unknown>) => ({ inputs, nodeId: 'n', runId: 'r', permissionScope: { allowedPaths: [], allowedDomains: [], shellEnabled: false }, report: vi.fn() })

describe('join node', () => {
  it('exposes N inputs from config.count and merges them', async () => {
    expect(JoinNodeDef.ports({ count: 3 }).inputs).toHaveLength(3)
    const out = await JoinNodeDef.execute!(ctx({ in1: 'a', in2: 'b' }) as never, { count: 2 })
    expect(out).toEqual({ value: { in1: 'a', in2: 'b' } })
  })
})

describe('start node', () => {
  it('emits the injected run input on its value port', async () => {
    const out = await StartNodeDef.execute!(ctx({ __runInput: 42 }) as never, {})
    expect(out).toEqual({ value: 42 })
  })
})
```

- [ ] **Step 2: Run, expect FAIL.** Run: `npx vitest run src/lib/workflows/nodes/__tests__/nodes.test.ts`
- [ ] **Step 3: Implement the five node files** per the behaviors above. Keep each `ConfigPanel` a small `'use client'`-free function component (it's a plain React component; no hooks that need the directive — but if it uses `useState`, add `'use client'` at the top of the file). For `agent`/`tool` ConfigPanels that read repos, load options with `useEffect`+`useState`.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit.** `git add src/lib/workflows/nodes && git commit -m "feat(workflow-w1): start/agent/tool/output/join node defs"`

---

## Task 6: Execution engine

**Files:**
- Create: `src/lib/workflows/engine.ts`
- Test: `src/lib/workflows/__tests__/engine.test.ts`

**Interfaces:**
- Consumes: `WorkflowGraph`/`validateGraph` (T4), `WorkflowNodeDef` (T1), `WORKFLOW_NODE_REGISTRY` (T8 — **mock it in tests**), `getEventBus` (T2 events).
- Produces (LOCKED):

```ts
export interface WorkflowRunResult {
  status: 'done' | 'error'
  output: Record<string, unknown> | null
  nodeStates: Record<string, { status: 'pending'|'running'|'done'|'error'; output?: Record<string, unknown>; error?: string }>
}
export interface RunWorkflowOpts { runId: string; permissionScope: PermissionScope; registry?: Map<string, WorkflowNodeDef> }
export function runWorkflow(graph: WorkflowGraph, input: unknown, opts: RunWorkflowOpts): Promise<WorkflowRunResult>
```

Algorithm (readiness): `validateGraph` first. Seed the `start` node's inputs with `{ __runInput: input }`. A node is **ready** when every incoming edge's source node is `done` and produced a value for the source port. Run all currently-ready, not-yet-run nodes **concurrently** (`Promise.all`); each: gather inputs from incoming edges (`inputs[targetPort] = sourceOutput[sourcePort]`), look up its def in the registry, emit `workflow:node-status` `running`, `await def.execute(ctx, node.config)`, store its outputs, emit `done` (or `error` on throw and stop scheduling its dependents). Repeat until no node is newly ready. `output` node's gathered inputs become `result.output`. Emit `workflow:run-started` at the top and `workflow:run-finished` at the end. `report()` in the ctx emits `workflow:node-status` with the given detail.

- [ ] **Step 1: Write failing tests** with a **fake registry** (a `Map` of fake defs) so the engine is tested in isolation, and `@/lib/event-bus` mocked. Cover: linear `start→A→output` passes data through; a diamond `start→(A,B)→join→output` runs A and B (assert both `execute`d) and join merges; a throwing node yields `status:'error'` and marks dependents not-run; `workflow:run-started`/`-finished` emitted.

```ts
import { describe, it, expect, vi } from 'vitest'
const emit = vi.fn()
vi.mock('@/lib/event-bus', () => ({ getEventBus: () => ({ emit }) }))
import { runWorkflow } from '@/lib/workflows/engine'
import type { WorkflowNodeDef } from '@/lib/interfaces'

function def(type: string, run: (i: Record<string, unknown>) => Record<string, unknown>): WorkflowNodeDef {
  return { type, category: 'compute', label: type, icon: '', ports: () => ({ inputs: [], outputs: [] }), defaultConfig: () => ({}), ConfigPanel: () => null, execute: async (ctx) => run(ctx.inputs) }
}

it('runs a linear graph and returns the output value', async () => {
  const registry = new Map<string, WorkflowNodeDef>([
    ['start', def('start', () => ({ value: 1 }))],
    ['inc', def('inc', (i) => ({ value: (i.input as number) + 1 }))],
    ['output', def('output', () => ({}))],
  ])
  const graph = {
    nodes: [{ id: 's', type: 'start', config: {} }, { id: 'a', type: 'inc', config: {} }, { id: 'o', type: 'output', config: {} }],
    edges: [
      { id: 'e1', source: 's', sourcePort: 'value', target: 'a', targetPort: 'input' },
      { id: 'e2', source: 'a', sourcePort: 'value', target: 'o', targetPort: 'value' },
    ],
  }
  const res = await runWorkflow(graph, 0, { runId: 'r1', permissionScope: { allowedPaths: [], allowedDomains: [], shellEnabled: false }, registry })
  expect(res.status).toBe('done')
  expect(res.output).toEqual({ value: 2 })
})
```
(Note: in this fake, `start` ignores `__runInput` and returns 1; the real `start` returns `__runInput`. The engine just calls `execute`.)

- [ ] **Step 2: Run, expect FAIL.** Run: `npx vitest run src/lib/workflows/__tests__/engine.test.ts`
- [ ] **Step 3: Implement `engine.ts`** per the algorithm. Default `opts.registry` to `WORKFLOW_NODE_REGISTRY` (imported lazily so the engine test can inject a fake without loading all node defs — accept `registry` param and use it).
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit.** `git add src/lib/workflows/engine.ts src/lib/workflows/__tests__/engine.test.ts && git commit -m "feat(workflow-w1): readiness execution engine (sequential/parallel/join)"`

---

## Task 7: useWorkflowRun hook

**Files:**
- Create: `src/hooks/useWorkflowRun.ts`
- Test: `src/hooks/__tests__/useWorkflowRun.test.ts`

**Interfaces:**
- Consumes: `getEventBus`, the `workflow:*` events (T2).
- Produces (LOCKED):

```ts
export interface WorkflowRunState {
  runId: string | null
  status: 'idle' | 'running' | 'done' | 'error'
  nodeStatus: Record<string, 'pending'|'running'|'done'|'error'>
  result: unknown
}
export function useWorkflowRun(runId: string | null): WorkflowRunState
```
Subscribes to `workflow:node-status`/`workflow:run-finished` filtered by `runId`; resets when `runId` changes; returns the rolling state for live editor overlays.

- [ ] **Step 1: Write failing test** (mock `@/lib/event-bus` with a functional bus — a listener map whose `emit` invokes `on` handlers, like the Phase-3 ChatPanel test): emit a `node-status` for the active run → `nodeStatus[nodeId]` updates; a `run-finished` → `status` + `result` update; events for another runId are ignored.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** mirroring `useApprovals.ts` (subscribe in `useEffect`, return unsubscribers; filter by `runId`; reset state on `runId` change).
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit.** `git add src/hooks/useWorkflowRun.ts src/hooks/__tests__/useWorkflowRun.test.ts && git commit -m "feat(workflow-w1): useWorkflowRun live-state hook"`

---

## Task 8: Workflow node registry + exhaustive test

**Files:**
- Create: `src/lib/workflows/node-registry.ts`
- Test: `src/lib/workflows/__tests__/node-registry.test.ts`

**Interfaces:**
- Consumes: the five node defs (T5).
- Produces (LOCKED):

```ts
export const WORKFLOW_NODE_REGISTRY: Map<string, WorkflowNodeDef>
export function registerWorkflowNode(def: WorkflowNodeDef): void
export function listWorkflowNodes(): WorkflowNodeDef[]
```

- [ ] **Step 1: Write the failing exhaustive test** (mirror `tools/__tests__/registry.test.ts` — keep the key list sorted + exhaustive):

```ts
import { describe, it, expect } from 'vitest'
import { WORKFLOW_NODE_REGISTRY, listWorkflowNodes, registerWorkflowNode } from '@/lib/workflows/node-registry'

const KEYS = ['agent', 'join', 'output', 'start', 'tool']

describe('WORKFLOW_NODE_REGISTRY', () => {
  it('is keyed by the built-in node types (exhaustive — update when adding one)', () => {
    expect([...WORKFLOW_NODE_REGISTRY.keys()].sort()).toEqual(KEYS)
  })
  it('every def matches its key and declares ports/config/panel', () => {
    for (const [key, def] of WORKFLOW_NODE_REGISTRY) {
      expect(def.type).toBe(key)
      expect(typeof def.defaultConfig).toBe('function')
      expect(typeof def.ConfigPanel).toBe('function')
      expect(def.ports(def.defaultConfig())).toHaveProperty('inputs')
    }
  })
  it('listWorkflowNodes returns all defs; registerWorkflowNode adds/replaces', () => {
    expect(listWorkflowNodes().map((d) => d.type).sort()).toEqual(KEYS)
  })
})
```

- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** (mirror `node-registry.ts` in `canvas/`): create the Map + `registerWorkflowNode` + `listWorkflowNodes`, then import and register the five defs at module load.
- [ ] **Step 4: Run, expect PASS.** Also run the engine test (it should still pass with the real registry available).
- [ ] **Step 5: Commit.** `git add src/lib/workflows/node-registry.ts src/lib/workflows/__tests__/node-registry.test.ts && git commit -m "feat(workflow-w1): WORKFLOW_NODE_REGISTRY + exhaustive test"`

---

## Task 9: WorkflowNodeCard (generic React Flow node)

**Files:**
- Create: `src/components/workflows/WorkflowNodeCard.tsx`
- Test: `src/components/workflows/__tests__/WorkflowNodeCard.test.tsx`

**Interfaces:**
- Consumes: `WORKFLOW_NODE_REGISTRY` (T8) to resolve a node's def → ports; `reactflow`'s `Handle`, `Position`, `NodeProps`.
- Produces (LOCKED): the React Flow node component + its data shape:

```ts
export interface WorkflowNodeCardData { type: string; config: NodeConfig; label: string; runStatus?: 'pending'|'running'|'done'|'error' }
export function WorkflowNodeCard(props: NodeProps<WorkflowNodeCardData>): JSX.Element
export const WORKFLOW_NODE_TYPE = 'workflowNode' // single RF node type for all workflow nodes
```
Renders a zinc/indigo card with the def's `icon`+`label`, a left `Handle type="target"` per input port (id = port name) and a right `Handle type="source"` per output port, plus a status ring colored by `runStatus`.

- [ ] **Step 1: Write a failing render test** (`@testing-library/react`): given data `{ type:'join', config:{count:2}, label:'Join' }`, it renders the label and 2 target handles + 1 source handle (assert by `data-handleid`/`.react-flow__handle` count via container query). Mock `reactflow` `Handle` as a `div` capturing props.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** the card; derive ports via `WORKFLOW_NODE_REGISTRY.get(data.type)?.ports(data.config)`.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit.** `git add src/components/workflows/WorkflowNodeCard.tsx src/components/workflows/__tests__/WorkflowNodeCard.test.tsx && git commit -m "feat(workflow-w1): generic workflow node card with port handles"`

---

## Task 10: NodePalette

**Files:**
- Create: `src/components/workflows/NodePalette.tsx`
- Test: `src/components/workflows/__tests__/NodePalette.test.tsx`

**Interfaces:**
- Consumes: `listWorkflowNodes()` (T8).
- Produces (LOCKED):

```ts
export interface NodePaletteProps { onAdd: (type: string) => void }
export function NodePalette(props: NodePaletteProps): JSX.Element
```
Lists each registry def (icon + label, grouped by category) as a button calling `onAdd(def.type)`.

- [ ] **Step 1: Failing test** — renders a button per node type; clicking "Agent" calls `onAdd('agent')`. Mock `@/lib/workflows/node-registry` `listWorkflowNodes` to return two fake defs.
- [ ] **Step 2: Run, expect FAIL.** **Step 3: Implement.** **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit.** `git add src/components/workflows/NodePalette.tsx src/components/workflows/__tests__/NodePalette.test.tsx && git commit -m "feat(workflow-w1): node palette"`

---

## Task 11: NodeConfigRail

**Files:**
- Create: `src/components/workflows/NodeConfigRail.tsx`
- Test: `src/components/workflows/__tests__/NodeConfigRail.test.tsx`

**Interfaces:**
- Consumes: `WORKFLOW_NODE_REGISTRY` (T8).
- Produces (LOCKED):

```ts
export interface NodeConfigRailProps {
  node: { id: string; type: string; config: NodeConfig } | null
  onChange: (config: NodeConfig) => void
  onClose: () => void
}
export function NodeConfigRail(props: NodeConfigRailProps): JSX.Element | null
```
When `node` is set, renders the def's `ConfigPanel` with `config` + an `onChange` that bubbles up; returns `null` when no node selected.

- [ ] **Step 1: Failing test** — given a fake def whose `ConfigPanel` renders an input wired to `onChange`, typing calls `props.onChange`. Returns null with `node=null`.
- [ ] **Step 2–4: red→green.** **Step 5: Commit.** `git add src/components/workflows/NodeConfigRail.tsx src/components/workflows/__tests__/NodeConfigRail.test.tsx && git commit -m "feat(workflow-w1): node config rail"`

---

## Task 12: RunModal

**Files:**
- Create: `src/components/workflows/RunModal.tsx`
- Test: `src/components/workflows/__tests__/RunModal.test.tsx`

**Interfaces:**
- Produces (LOCKED):

```ts
export interface RunModalProps { open: boolean; onClose: () => void; onRun: (input: unknown) => void }
export function RunModal(props: RunModalProps): JSX.Element | null
```
A textarea for the Start input (parsed as JSON if valid, else passed as a string) + a Run button calling `onRun(parsedInput)`; Cancel calls `onClose`.

- [ ] **Step 1: Failing test** — typing `{"q":1}` + Run calls `onRun({ q: 1 })`; typing `hello` + Run calls `onRun('hello')`.
- [ ] **Step 2–4: red→green.** **Step 5: Commit.** `git add src/components/workflows/RunModal.tsx src/components/workflows/__tests__/RunModal.test.tsx && git commit -m "feat(workflow-w1): run input modal"`

---

## Task 13: WorkflowEditor (integration)

**Files:**
- Create: `src/components/workflows/WorkflowEditor.tsx`
- Test: `src/components/workflows/__tests__/WorkflowEditor.test.tsx`

**Interfaces:**
- Consumes: `WorkflowNodeCard`/`WORKFLOW_NODE_TYPE` (T9), `NodePalette` (T10), `NodeConfigRail` (T11), `RunModal` (T12), `normalizeGraph` (T4), `runWorkflow` (T6), `useWorkflowRun` (T7), `WorkflowRepository`+`WorkflowRunRepository`+`initDb` (T3), `getNodeTypes`-style RF setup (mirror `AgentCanvas`).
- Produces (LOCKED):

```ts
export interface WorkflowEditorProps { workflowId: string; onBack: () => void }
export function WorkflowEditor(props: WorkflowEditorProps): JSX.Element
```

Behavior: loads the workflow row; React Flow with `useNodesState`/`useEdgesState` and `nodeTypes={{ [WORKFLOW_NODE_TYPE]: WorkflowNodeCard }}`; palette `onAdd` appends a node (`type: WORKFLOW_NODE_TYPE`, `data: { type, config: def.defaultConfig(), label: def.label }`); `onConnect` adds an edge (carry `sourceHandle`/`targetHandle`); selecting a node opens the config rail (writes back into node data); **Save** persists via `WorkflowRepository.update(id, { nodes, edges })`; **Run** opens `RunModal` → on run: `normalizeGraph` → `WorkflowRunRepository.create` → `runWorkflow(graph, input, { runId, permissionScope: { allowedPaths:[], allowedDomains:[], shellEnabled:false } })` → `WorkflowRunRepository.finish(...)`; live per-node status via `useWorkflowRun(activeRunId)` mapped onto node `data.runStatus`.

- [ ] **Step 1: Failing test** (mock `@/lib/storage`, `@/lib/workflows/engine` `runWorkflow`, `reactflow` minimally, `@/lib/workflows/node-registry`): renders, palette-add appends a node, Save calls `WorkflowRepository.update`, Run (with a stubbed graph) calls `runWorkflow`. Keep assertions behavioral (don't deep-test React Flow internals).
- [ ] **Step 2: Run, expect FAIL.** **Step 3: Implement** (mirror `AgentCanvas` for the RF wiring + `bg-[#09090b]`; hand-rolled zinc/indigo chrome for palette/rail/top-bar). **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit.** `git add src/components/workflows/WorkflowEditor.tsx src/components/workflows/__tests__/WorkflowEditor.test.tsx && git commit -m "feat(workflow-w1): workflow editor canvas"`

---

## Task 14: WorkflowsPanel + page wiring

**Files:**
- Create: `src/components/workflows/WorkflowsPanel.tsx`
- Modify: `src/app/page.tsx`
- Test: `src/components/workflows/__tests__/WorkflowsPanel.test.tsx`, extend `src/app/__tests__/page.test.tsx`

**Interfaces:**
- Consumes: `WorkflowRepository`+`initDb` (T3), `WorkflowEditor` (T13).
- Produces (LOCKED):

```ts
export interface WorkflowsPanelProps { onClose: () => void }
export function WorkflowsPanel(props: WorkflowsPanelProps): JSX.Element
```
A full-height right panel (mirror `StorePanel`'s `absolute inset-y-0 right-0 ... bg-[#0d0d0f] border-l`): lists `WorkflowRepository.findAll()`, a **New workflow** button (`create({ name: 'Untitled workflow' })` → open editor), open/delete per row; when one is open, renders `<WorkflowEditor workflowId onBack=.../>`.

- [ ] **Step 1: Failing tests** — `WorkflowsPanel` lists rows from a mocked `WorkflowRepository`, New calls `create` then shows the editor (mock `WorkflowEditor` as a stub). In `page.test.tsx`, add a stub mock for `@/components/workflows/WorkflowsPanel` and assert it renders when `activeNav === 'workflows'` (drive the nav via the `Sidebar` stub as existing tests do).
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement `WorkflowsPanel`**, then wire `page.tsx`: import it and add inside the canvas container, after the Settings panel line:

```tsx
{activeNav === 'workflows' && <WorkflowsPanel onClose={() => setActiveNav('home')} />}
```

- [ ] **Step 4: Run, expect PASS.** Run: `npx vitest run src/components/workflows/__tests__/WorkflowsPanel.test.tsx src/app/__tests__/page.test.tsx`
- [ ] **Step 5: Commit.** `git add src/components/workflows/WorkflowsPanel.tsx src/app/page.tsx src/components/workflows/__tests__/WorkflowsPanel.test.tsx src/app/__tests__/page.test.tsx && git commit -m "feat(workflow-w1): workflows panel + page nav wiring"`

---

## Final integration gate (orchestrator, after all tasks)

1. `npx tsc --noEmit` → exit 0.
2. `npx vitest run` → all pass; the new `WORKFLOW_NODE_REGISTRY` test green; the **four pre-existing** registry tests untouched.
3. `npx eslint <changed files>` → no new errors.
4. `npm run build` → `out/` emitted (static export intact — confirm no Node-only import crept into the client graph via the engine/nodes).
5. **Agent smoke (web mode):** `npm run dev` (or Playwright) — open **Workflows**, create a workflow, drop `start`/`agent`/`output`, connect them, Save, reopen → persisted; the editor renders and the Run modal opens. *(A real agent/tool execution inside a run is desktop-gated — emit a `tauri:dev` checklist: run a `start → agent → output` workflow against a configured model and confirm live node status + a result.)*

## Self-review notes (coverage vs. spec W1)

- Spec §1 node contract → T1. §4 storage → T3 (FK order enforced). §5 events → T2. §3 engine (sequential/parallel/join, no control flow) → T4 (graph) + T6 (engine). §2 node palette subset (`start`/`agent`/`tool`/`output`/`join`) → T5 + T8. §6 UI (editor/palette/config rail/run) → T9–T14. Live status hook → T7.
- `conditional`/`loop`/`transform` and run-history UI are intentionally **out of W1** (W2/W3).
- Mock-with-`new` rule, registry-test rules, and static-export rule are in Global Constraints and repeated per task where relevant.
