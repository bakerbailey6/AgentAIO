# Workflow Builder — W2 (Control Flow) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Add control-flow node types — `conditional` (branch), `transform` (shape data), `loop` (iterate a sub-workflow over an array) — to the Workflow Builder, per the approved spec [`2026-06-19-workflow-builder-design.md`](../specs/2026-06-19-workflow-builder-design.md). W3 (data-wiring UX + run history) follows.

**Architecture / key decision:** **No engine change.** The W1 readiness engine already gives us control flow for free:
- `conditional` produces a value on **only one** output port (`true` or `false`); the other branch's downstream never becomes ready, so it's pruned — exactly the engine's existing behavior.
- `loop` is a plain compute node whose `execute` **recursively calls `runWorkflow`** on a referenced sub-workflow, once per array item (bounded). The "body" is a saved workflow selected in the loop's config — a clean realization of iteration on a flat-graph system that reuses the engine instead of special-casing the scheduler.
- `transform` is a plain compute node.

All three are **security-safe by construction**: no `eval`, no string-expression parser. `conditional` uses a structured predicate (`{path, op, value}`); `transform` uses `{{path}}` template substitution. The shared logic lives in `src/lib/workflows/expr.ts`.

**Tech Stack:** TypeScript · Vitest/jsdom · the W1 workflow engine/registry (already on the branch).

## Global Constraints
- Reuse the W1 base on this branch (`WorkflowNodeDef`, `WORKFLOW_NODE_REGISTRY`, `runWorkflow`, `normalizeGraph`, storage). Run all checks from the worktree; junction `node_modules → C:\Projects\node_modules`, never `npm install`.
- **No `eval`** anywhere (spec §9.3 zero-trust). No string-expression parser — use structured predicates + template substitution only.
- Static-export safe: pure TS, no Node-only imports.
- `WorkflowNodeDef<TConfig>` is invariant via `ConfigPanel`; register typed defs with `as unknown as WorkflowNodeDef` (the pattern `node-registry.ts` already uses).
- **Registry test:** W2 adds 3 entries, so the `WORKFLOW_NODE_REGISTRY` exhaustive test (`src/lib/workflows/__tests__/node-registry.test.ts`) MUST be updated (KEYS becomes `['agent','conditional','join','loop','output','start','tool','transform']`). The OTHER four registry tests (node/agents/tools/mcp) stay untouched.
- Mocks used with `new` = class/`function`, never arrow.
- ConfigPanels that use hooks/state need `'use client'`; keep files `.ts` and write panels with `React.createElement` (as the W1 node defs do) — or use `.tsx`; match the W1 node-def style (`React.createElement`, `.ts`).

## File Structure
- `src/lib/workflows/expr.ts` *(new)* — `getPath`, `applyTemplate`, `evalPredicate` (the safe, eval-free helpers) + test.
- `src/lib/workflows/nodes/conditional.ts` *(new)* + test.
- `src/lib/workflows/nodes/transform.ts` *(new)* + test.
- `src/lib/workflows/nodes/loop.ts` *(new)* + test.
- `src/lib/workflows/node-registry.ts` *(modify)* — register the 3 new defs.
- `src/lib/workflows/__tests__/node-registry.test.ts` *(modify)* — update the exhaustive KEYS.

**Parallel batches:** Wave 1 = expr (root). Wave 2 (parallel, after expr) = conditional · transform · loop. Wave 3 = registry update + exhaustive-test update.

---

## Task 1: Safe expression helpers (`expr.ts`)

**Files:** Create `src/lib/workflows/expr.ts` + `src/lib/workflows/__tests__/expr.test.ts`.

**Produces (LOCKED):**
```ts
/** Read a dot-path (e.g. "input.user.name") from a value; undefined if absent. */
export function getPath(value: unknown, path: string): unknown
/** Replace each `{{path}}` in `template` with String(getPath(ctx, path)); unknown → ''. */
export function applyTemplate(template: string, ctx: Record<string, unknown>): string
export type PredicateOp = 'truthy' | 'falsy' | 'eq' | 'neq' | 'gt' | 'lt'
export interface Predicate { path?: string; op: PredicateOp; value?: unknown }
/** Evaluate a structured predicate against an input value (no eval). */
export function evalPredicate(input: unknown, pred: Predicate): boolean
```
Semantics: `getPath` splits on `.` and walks objects/arrays, returning `undefined` on any miss. `applyTemplate` regex-replaces `/\{\{\s*([\w.]+)\s*\}\}/g`. `evalPredicate`: resolve `target = pred.path ? getPath(input, pred.path) : input`; `truthy`→`!!target`, `falsy`→`!target`, `eq`→`target === pred.value`, `neq`→`target !== pred.value`, `gt`→`Number(target) > Number(pred.value)`, `lt`→`Number(target) < Number(pred.value)`.

- [ ] **Step 1: Failing tests** — `getPath({a:{b:2}}, 'a.b') === 2`, miss → undefined; `applyTemplate('Hi {{input.name}}', {input:{name:'X'}}) === 'Hi X'`, unknown path → ''; `evalPredicate(5, {op:'gt', value:3}) === true`, `evalPredicate({x:0},{path:'x',op:'truthy'}) === false`, eq/neq/falsy cases.
- [ ] **Step 2: Run → FAIL.** `npx vitest run src/lib/workflows/__tests__/expr.test.ts`
- [ ] **Step 3: Implement** (pure functions; no `eval`, no `Function`, no parser).
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit.** `git add src/lib/workflows/expr.ts src/lib/workflows/__tests__/expr.test.ts && git commit -m "feat(workflow-w2): safe expression helpers (getPath/applyTemplate/evalPredicate)"`

---

## Task 2: `conditional` node

**Files:** Create `src/lib/workflows/nodes/conditional.ts` + `__tests__/conditional.test.ts`.
**Consumes:** `WorkflowNodeDef` (interfaces), `evalPredicate`/`Predicate`/`PredicateOp` (expr, Task 1).

**Produces (LOCKED):** `export const ConditionalNodeDef: WorkflowNodeDef`
- `type:'conditional'`, `category:'control'`, label "Conditional", icon e.g. '🔀'.
- config `{ path?: string; op: PredicateOp; value?: unknown }` (extends `NodeConfig`); `defaultConfig` `{ op: 'truthy' }`.
- `ports`: inputs `[{name:'input',label:'Input',type:'any'}]`; outputs `[{name:'true',label:'True',type:'any'},{name:'false',label:'False',type:'any'}]`.
- `execute(ctx)`: `const passed = evalPredicate(ctx.inputs.input, { path: config.path, op: config.op, value: config.value })`; return `passed ? { true: ctx.inputs.input } : { false: ctx.inputs.input }` (produce exactly ONE output port — the engine prunes the other branch).
- ConfigPanel (`'use client'`, React.createElement): an op `<select>` (the 6 ops), an optional `path` `<input>`, and a `value` `<input>` (shown for eq/neq/gt/lt).

- [ ] Failing test: `passed` case returns `{true: input}` (no `false` key) and vice-versa; predicate uses path/op/value. Run → FAIL → implement → PASS → commit (`feat(workflow-w2): conditional node`).

---

## Task 3: `transform` node

**Files:** Create `src/lib/workflows/nodes/transform.ts` + `__tests__/transform.test.ts`.
**Consumes:** `WorkflowNodeDef`, `applyTemplate` (expr, Task 1).

**Produces (LOCKED):** `export const TransformNodeDef: WorkflowNodeDef`
- `type:'transform'`, `category:'compute'`, label "Transform", icon '🔧'.
- config `{ template: string }`; `defaultConfig` `{ template: '{{input}}' }`.
- `ports`: inputs `[{name:'input',label:'Input',type:'any'}]`; outputs `[{name:'output',label:'Output',type:'json'}]`.
- `execute(ctx)`: `const text = applyTemplate(config.template, { input: ctx.inputs.input })`; try `JSON.parse(text)` → return `{ output: parsed }`; on parse error return `{ output: text }` (raw string).
- ConfigPanel (`'use client'`): a `template` `<textarea>` with a hint "Use {{input}} or {{input.field}}".

- [ ] Failing test: template `'{{input.name}}'` with `input:{name:'Ada'}` → `{output:'Ada'}`; a JSON template `'{"n": {{input}}}'` with `input:5` → `{output:{n:5}}`; non-JSON → raw string. Run → FAIL → implement → PASS → commit (`feat(workflow-w2): transform node`).

---

## Task 4: `loop` node (iterate a sub-workflow)

**Files:** Create `src/lib/workflows/nodes/loop.ts` + `__tests__/loop.test.ts`.
**Consumes:** `WorkflowNodeDef`, `runWorkflow` (`@/lib/workflows/engine`), `normalizeGraph` (`@/lib/workflows/graph`), `initDb`+`WorkflowRepository` (`@/lib/storage`). **Lazy-import** `WORKFLOW_NODE_REGISTRY` (`@/lib/workflows/node-registry`) inside `execute` via `await import(...)` to avoid the node-registry↔loop static cycle.

**Produces (LOCKED):** `export const LoopNodeDef: WorkflowNodeDef`
- `type:'loop'`, `category:'control'`, label "Loop", icon '🔁'.
- config `{ subWorkflowId?: string; maxIterations?: number }`; `defaultConfig` `{ maxIterations: 100 }`.
- `ports`: inputs `[{name:'items',label:'Items',type:'json'}]`; outputs `[{name:'results',label:'Results',type:'json'}]`.
- `execute(ctx)`:
  - `if (!config.subWorkflowId) throw new Error('loop node has no sub-workflow selected')`.
  - `const items = Array.isArray(ctx.inputs.items) ? ctx.inputs.items : []`.
  - `const cap = config.maxIterations ?? 100`; if `items.length > cap` throw `Error(\`loop exceeds maxIterations (${cap})\`)` (bounded — no runaway).
  - Load sub-workflow: `const db = await initDb(); const row = await new WorkflowRepository(db).findById(config.subWorkflowId)`; if `!row` throw. `const graph = normalizeGraph(row.nodes as ..., row.edges as ...)`.
  - `const { WORKFLOW_NODE_REGISTRY } = await import('@/lib/workflows/node-registry')`.
  - For each item (sequentially, index `i`): `const r = await runWorkflow(graph, item, { runId: \`${ctx.runId}:loop:${i}\`, permissionScope: ctx.permissionScope, registry: WORKFLOW_NODE_REGISTRY }); results.push(r.output)`. `ctx.report('running', \`item ${i+1}/${items.length}\`)`.
  - return `{ results }`.
- ConfigPanel (`'use client'`): a sub-workflow `<select>` (load `WorkflowRepository.findAll()` via useEffect) + a `maxIterations` number input.

- [ ] Failing test (mock `@/lib/storage` WorkflowRepository as a class with `findById`→a row, `findAll`; `initDb`; mock `@/lib/workflows/engine` `runWorkflow`→`{status:'done',output:{v:1},nodeStates:{}}`; mock `@/lib/workflows/graph` `normalizeGraph`→stub; the lazy `node-registry` import resolves to the real module on this branch, or mock it): no subWorkflowId → throws; items `[a,b]` → `runWorkflow` called twice, returns `{results:[{v:1},{v:1}]}`; non-array items → `{results:[]}`; over-cap → throws. Run → FAIL → implement → PASS → commit (`feat(workflow-w2): loop node (sub-workflow iteration)`).

---

## Task 5: Register the 3 nodes + update the exhaustive test

**Files:** Modify `src/lib/workflows/node-registry.ts` + `src/lib/workflows/__tests__/node-registry.test.ts`.
**Consumes:** `ConditionalNodeDef`, `TransformNodeDef`, `LoopNodeDef` (Tasks 2–4).

- [ ] **Step 1:** Update the test KEYS to `['agent','conditional','join','loop','output','start','tool','transform']` (sorted). Run → FAIL (registry doesn't have them yet).
- [ ] **Step 2:** In `node-registry.ts` import the 3 defs and `registerWorkflowNode` them (cast `as unknown as WorkflowNodeDef` where typed). Run → PASS.
- [ ] **Step 3:** Commit. `git add src/lib/workflows/node-registry.ts src/lib/workflows/__tests__/node-registry.test.ts && git commit -m "feat(workflow-w2): register conditional/transform/loop in WORKFLOW_NODE_REGISTRY"`

---

## Final integration gate (orchestrator)
1. `npx tsc --noEmit` → 0.
2. `npx vitest run` → all pass; the `WORKFLOW_NODE_REGISTRY` exhaustive test updated to 8 keys; the **four** pre-existing registry tests untouched.
3. `npx eslint <changed>` → no new errors.
4. `npm run build` → `out/` emitted (no `eval`/Node import crept in).
5. **Web smoke:** the new nodes appear in the editor palette (`listWorkflowNodes()` drives it) and can be added/configured. Real branch/loop execution is desktop-gated (needs the DB for loop's sub-workflow + agents) → `tauri:dev` checklist.

## Self-review (coverage vs spec W2)
- conditional (branch) → T2 (engine prunes the unproduced port — no engine change, verified by W1 engine tests). transform → T3. loop → T4 (sub-workflow iteration via recursive `runWorkflow`, bounded). The eval-free safety requirement → T1 (structured predicate + template substitution, no parser). Registry exhaustiveness → T5.
- Deviation noted: `loop` iterates a **referenced sub-workflow** rather than an inline body subgraph — a cleaner realization on a flat graph that reuses the engine; the inline-subgraph variant can be a later enhancement.
