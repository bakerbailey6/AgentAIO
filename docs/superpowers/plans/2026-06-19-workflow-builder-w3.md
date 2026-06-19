# Workflow Builder — W3 (Data-wiring UX + Run History) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Round out the Workflow Builder per the spec's W3: **port-type validation** in the editor (block/flag incompatible wirings) and a **run-history** view over `workflow_runs` with **re-run**. Final Workflow Builder increment.

**Architecture:** Two standalone units (a pure port-compat helper; a run-history component) plus a thin integration into the existing `WorkflowEditor`. No engine/storage schema changes — `workflow_runs` + `WorkflowRunRepository.findByWorkflowId` already exist from W1.

**Tech Stack:** TypeScript · React · `reactflow` · Vitest/jsdom · the W1/W2 workflow layer (already on the branch).

## Global Constraints
- Reuse the W1/W2 base on this branch. Run checks from the worktree; junction `node_modules → C:\Projects\node_modules`; **never** `npm install`; **never** `git worktree remove --force` a junction-bearing worktree.
- Static-export safe; no `eval`; no Node-only imports. `'use client'` on interactive components; hand-rolled zinc/indigo; named exports (workflows folder).
- Do NOT touch the four pre-existing exhaustive registry tests. W3 adds no registry entries.
- Mocks used with `new` = class/`function`.

## File Structure
- `src/lib/workflows/port-compat.ts` *(new)* — pure helpers: `arePortTypesCompatible`, `connectionPortTypes`, `isConnectionCompatible` (+ test).
- `src/components/workflows/WorkflowRunHistory.tsx` *(new)* — lists `workflow_runs` for a workflow + re-run (+ test).
- `src/components/workflows/WorkflowEditor.tsx` *(modify)* — validate `onConnect` via port-compat (reject incompatible + a transient notice); add a **History** toggle rendering `WorkflowRunHistory`; wire re-run; refresh history after a run (+ extend test).

**Waves:** Wave 1 (parallel) = T1 port-compat · T2 run-history. Wave 2 = T3 editor integration (depends on T1+T2).

---

## Task 1: Port-type compatibility helper

**Files:** Create `src/lib/workflows/port-compat.ts` + `src/lib/workflows/__tests__/port-compat.test.ts`.

**Produces (LOCKED):**
```ts
import type { PortType, NodeConfig, WorkflowNodeDef } from '@/lib/interfaces'

/** Two port types are compatible if either is `any` or they are equal. */
export function arePortTypesCompatible(source: PortType, target: PortType): boolean

export interface EditorNodeLike { id: string; data: { type: string; config: NodeConfig } }
export interface ConnectionLike { source: string; sourceHandle?: string | null; target: string; targetHandle?: string | null }

/** Resolve a connection's source-output and target-input port types from the graph + registry; undefined if unresolved. */
export function connectionPortTypes(
  nodes: EditorNodeLike[],
  registry: Map<string, WorkflowNodeDef>,
  conn: ConnectionLike,
): { source?: PortType; target?: PortType }

/** True if the connection is type-compatible. Lenient: if either type can't be resolved, allow it (return true). */
export function isConnectionCompatible(nodes: EditorNodeLike[], registry: Map<string, WorkflowNodeDef>, conn: ConnectionLike): boolean
```
`connectionPortTypes`: find the source node by `conn.source`; `def = registry.get(node.data.type)`; `def.ports(node.data.config).outputs.find(p => p.name === conn.sourceHandle)?.type`; same for target inputs with `conn.targetHandle`. `isConnectionCompatible`: resolve both; if either is undefined return `true` (lenient — don't block when ports are unknown, e.g. a self-loop or missing handle); else `arePortTypesCompatible`.

- [ ] **Step 1: Failing tests** — `arePortTypesCompatible('any','text')===true`, `('text','text')===true`, `('text','json')===false`; with a fake registry (a def whose outputs=[{name:'out',type:'text'}] and inputs=[{name:'in',type:'json'}]), `isConnectionCompatible` is false for text→json, true for any→json, true when a handle name doesn't resolve.
- [ ] **Step 2: Run → FAIL.** `npx vitest run src/lib/workflows/__tests__/port-compat.test.ts`
- [ ] **Step 3: Implement** (pure functions).
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit.** `git add src/lib/workflows/port-compat.ts src/lib/workflows/__tests__/port-compat.test.ts && git commit -m "feat(workflow-w3): port-type compatibility helper"`

---

## Task 2: Run-history component

**Files:** Create `src/components/workflows/WorkflowRunHistory.tsx` + `__tests__/WorkflowRunHistory.test.tsx`.
**Consumes:** `initDb`, `WorkflowRunRepository`, `WorkflowRunRow` from `@/lib/storage`.

**Produces (LOCKED):**
```ts
export interface WorkflowRunHistoryProps {
  workflowId: string
  onRerun: (input: unknown) => void
  /** Bump to force a reload (e.g. after a run finishes). */
  refreshKey?: number
}
export function WorkflowRunHistory(props: WorkflowRunHistoryProps): React.JSX.Element
```
Behavior: on mount and whenever `workflowId`/`refreshKey` change, `initDb()` (cancel-guarded) → `new WorkflowRunRepository(db).findByWorkflowId(workflowId)` → list newest-first. Each row: a status badge (`done` green / `error` red / `running` amber), the started time, a truncated `JSON.stringify(result)` preview, and a **Re-run** button calling `onRerun(run.input)`. Empty state: muted "No runs yet." Hand-rolled zinc/indigo.

- [ ] **Step 1: Failing test** — mock `@/lib/storage` (WorkflowRunRepository as a **class**: `findByWorkflowId`→`[{id:'r1',workflowId:'wf1',status:'done',input:{q:1},result:{ok:true},nodeStates:{},startedAt:0,finishedAt:1}]`; `initDb`). Assert it lists the run (status shown) after load; clicking **Re-run** calls `onRerun({q:1})`; empty list → "No runs yet."
- [ ] **Step 2: Run → FAIL.** **Step 3: Implement.** **Step 4: Run → PASS.**
- [ ] **Step 5: Commit.** `git add src/components/workflows/WorkflowRunHistory.tsx src/components/workflows/__tests__/WorkflowRunHistory.test.tsx && git commit -m "feat(workflow-w3): run-history component"`

---

## Task 3: Editor integration (port validation + history + re-run)

**Files:** Modify `src/components/workflows/WorkflowEditor.tsx` + `__tests__/WorkflowEditor.test.tsx`.
**Consumes:** `isConnectionCompatible` (T1), `WorkflowRunHistory` (T2), plus the existing editor deps.

Changes:
- **Port validation in `onConnect`:** before `addEdge`, compute `ok = isConnectionCompatible(nodes, WORKFLOW_NODE_REGISTRY, connection)`. If not `ok`, set a transient `connectError` state (e.g. "Incompatible port types") shown briefly in the top bar and **return without adding the edge**. Otherwise add as before.
- **History toggle:** a top-bar **History** button toggles a right-side `<WorkflowRunHistory workflowId={workflowId} refreshKey={historyKey} onRerun={handleRerun} />` panel (mutually exclusive with the config rail, or stacked — keep simple: a toggle that shows the history panel in place of the config rail).
- **Re-run:** `handleRerun(input)` runs the workflow with that input directly (reuse the existing run path: `normalizeGraph` → `WorkflowRunRepository.create` → `runWorkflow` → `finish`), then bump `historyKey` to reload history. Also bump `historyKey` after any normal run completes.

- [ ] **Step 1: Extend the test** — mock `@/lib/workflows/port-compat` (`isConnectionCompatible`) and `@/components/workflows/WorkflowRunHistory` (stub exposing a re-run button). Assert: an incompatible `onConnect` does NOT add an edge (and shows the notice); the History toggle renders the history stub; the stub's re-run triggers the run path (`runWorkflow` called). Keep all existing WorkflowEditor tests passing.
- [ ] **Step 2: Run → FAIL.** **Step 3: Implement** (read the current `WorkflowEditor.tsx` first; make minimal, additive changes — keep Save/Run/palette/config-rail intact). **Step 4: Run → PASS.**
- [ ] **Step 5: Commit.** `git add src/components/workflows/WorkflowEditor.tsx src/components/workflows/__tests__/WorkflowEditor.test.tsx && git commit -m "feat(workflow-w3): editor port validation + run history + re-run"`

---

## Final integration gate (orchestrator)
1. `npx tsc --noEmit` → 0. 2. `npx vitest run` → all pass; four pre-existing registry tests untouched. 3. `npx eslint <changed>` → no new errors. 4. `npm run build` → `out/` emitted. 5. Web smoke: the editor blocks an incompatible wire and the History panel renders (DB-backed list is desktop-gated).

## Self-review (coverage vs spec W3)
- Editor port-type validation/affordances → T1 + T3. Run-history view over `workflow_runs` → T2 + T3. Re-run → T3. No schema/engine changes needed (W1 already has `workflow_runs` + `findByWorkflowId`).
