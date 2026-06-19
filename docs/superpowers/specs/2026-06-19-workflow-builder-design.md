# Workflow Builder — Design Spec

> **Status:** Approved design (2026-06-19). Implementation is **staged** into W1/W2/W3,
> each with its own plan (`writing-plans`) + PR + the same QA gates used for Phases 3–5.
> Spec author: brainstorming pass off merged `main` (post Phase-5).

## Context

The design spec ([`2026-06-18-agent-command-center-design.md`](2026-06-18-agent-command-center-design.md))
lists **Phase 2 — Workflow Builder: "Visual node graph for chaining agents and tools."** as a
top-level capability, and the data model table lists a `workflows` row. Neither exists yet: there is
**no `workflows` table** in [`schema.ts`](../../../src/lib/storage/schema.ts) (only `agents`,
`sessions`, `models`, `mcps`, `tools`, `audit_log`, `canvas_state`), no workflow UI, and no runtime.
The sidebar already has a **Workflows** nav entry (currently inert).

The user chose the **full visual-programming** scope (branching, loops, parallel fan-out/join,
port-level data wiring) built as **one coherent architecture, shipped in verifiable sub-phases**.
This spec defines that architecture; the staged plans build it.

**What this reuses (don't reinvent):**
- The **React Flow** canvas already used by `AgentCanvas` (`reactflow` is a dependency).
- The **registry-by-interface** pattern: `NODE_REGISTRY`, `AGENT_REGISTRY`, `TOOL_REGISTRY`,
  `PROVIDER_REGISTRY` — a new capability = implement an interface + register it in a Map.
- The **agent runtime**: `AGENT_REGISTRY.get(type).run(session, input)` streaming `AgentEvent`s, with
  the Phase-3 approval gate (`src/lib/agents/approval-gate.ts`) and the tool-call loop.
- The **tool/MCP layer**: `TOOL_REGISTRY` + `getMCPRegistry()` (Phases 3–5).
- The **event bus** (`getEventBus()`) + consumer-hook pattern for live UI.
- The **storage pattern**: migrations-as-constants in `schema.ts` (ordered `ALL_MIGRATIONS`), one
  hand-written repository per table (snake_case columns ↔ camelCase `*Row`, `$1..$n` params, JSON
  columns stringified), re-exported from `src/lib/storage/index.ts`.
- The **static-export constraint**: the app is a client SPA bundled into Tauri; the engine runs
  **in-process** (no Server Actions / route handlers). Native effects go through existing Tauri
  commands (agents/tools already do).

---

## Architecture

### 1. Node model — `WorkflowNodeDef` registry

New contract `src/lib/interfaces/workflow-node.ts`, collected in `WORKFLOW_NODE_REGISTRY`
(`src/lib/workflows/node-registry.ts`), mirroring `NODE_REGISTRY`. Adding a node type means
implementing the interface and registering it — no engine/editor edits.

```ts
export type PortType = 'text' | 'json' | 'any'

export interface PortDef {
  name: string            // stable port id, unique within the node's side
  label: string
  type: PortType          // advisory in v1 (UI hint + light validation)
}

/** Per-node-instance config, persisted in the node's data. */
export type NodeConfig = Record<string, unknown>

export interface WorkflowNodeContext {
  /** Input values keyed by input-port name. */
  inputs: Record<string, unknown>
  nodeId: string
  runId: string
  /** Permission scope for agent/tool steps (mirrors AgentSession). */
  permissionScope: PermissionScope
  /** Emit a status/log line for this node (engine wires it to the bus). */
  report(status: NodeRunStatus, detail?: string): void
}

export interface WorkflowNodeDef<TConfig extends NodeConfig = NodeConfig> {
  readonly type: string                 // e.g. 'agent', 'tool', 'conditional'
  readonly category: 'io' | 'compute' | 'control'
  readonly label: string
  readonly icon: string
  ports(config: TConfig): { inputs: PortDef[]; outputs: PortDef[] }  // may depend on config
  defaultConfig(): TConfig
  /** React panel to edit this node's config (right rail). */
  ConfigPanel: ComponentType<{ config: TConfig; onChange: (c: TConfig) => void }>
  /**
   * Execute a data/compute node, returning a value per output port.
   * Control-flow nodes (conditional/loop/join) are handled by the engine and
   * may leave this undefined or implement a narrow form (see §3).
   */
  execute?(ctx: WorkflowNodeContext, config: TConfig): Promise<Record<string, unknown>>
}
```

`ports()` is config-dependent so e.g. a `conditional` exposes `true`/`false` outputs and a `join`
can expose N inputs.

### 2. Node palette (v1 full set, delivered across W1–W2)

| type | category | role |
|---|---|---|
| `start` | io | Workflow entry. Emits the run's initial input value (user-supplied at run time) on its output port. Exactly one per workflow. |
| `agent` | compute | Runs a configured agent (`AGENT_REGISTRY`) with a **prompt template** (`{{portName}}` substitution from inputs); outputs the agent's final text (and raw result on a `json` port). Reuses the Phase-3 runtime + approval gate. |
| `tool` | compute | Invokes a built-in (`TOOL_REGISTRY`) or MCP tool; inputs mapped to the tool's `inputSchema`; outputs the tool result. Dangerous tools gate via Phase-3 approval. |
| `transform` | compute | Shapes data between nodes via a **constrained template/expression** — **no arbitrary `eval`** (a small whitelist: field access, `{{...}}` templating, basic JSON shaping). Security-critical (zero-trust §9.3). |
| `conditional` | control | Evaluates a safe predicate over inputs → routes the input value to the `true` or `false` output port (the other stays unproduced, pruning that branch). |
| `loop` | control | `forEach` over an array input: runs its **body subgraph** once per item, collecting each iteration's output into an array on its output port. (Bounded iteration count for safety.) |
| `join` | control | Barrier: waits for all connected inputs, emits them as a combined object on its output. |
| `output` | io | Result sink. Its inputs become the run's result. |

Parallelism is **implicit**: independent ready branches run concurrently (no explicit fan-out node);
`join` is the explicit barrier when branches must re-converge.

### 3. Execution engine — `src/lib/workflows/engine.ts` (in-process)

`runWorkflow(graph, input, { permissionScope, runId }): Promise<WorkflowRunResult>`.

- **Validate** first: exactly one `start`, port connections type-compatible (advisory), no
  unsupported cycles (only `loop` bodies may cycle), required inputs connected. Invalid → typed error
  before any node runs.
- **Readiness execution:** a node runs once every connected input port has a value. Independent ready
  nodes run **concurrently** (`Promise.all` over the ready frontier); the frontier re-computes as
  outputs land. This yields sequential, parallel, and join behavior from one mechanism.
- **`conditional`:** produces a value on only one output port; downstream nodes on the unproduced port
  never become ready (branch pruned).
- **`loop`:** the engine runs the body subgraph (the nodes reachable from the loop's body output until
  its body-return port) once per array item, isolating each iteration's node states, then aggregates.
  A per-node iteration cap (config, **default 100**) prevents runaways.
- **Per-node lifecycle:** the engine emits `workflow:node-status` (`pending → running → done|error`,
  with output preview) on the event bus; `report()` in the context routes there. Agent/tool nodes
  surface approvals through the existing `agent:approval-requested/-resolved` plumbing.
- **Errors:** a node throwing marks it `error`; its dependents never become ready; the run finishes
  `error` with the partial node-state map. (A `continueOnError` per-node flag is a W3 nicety, not v1.)
- **Result:** `{ status, output (the `output` node's inputs), nodeStates: Record<nodeId, {status, output?, error?}> }`.

The engine is pure orchestration over `WorkflowNodeDef.execute` + a small set of control-node handlers
— unit-testable with fake node defs and no React/Tauri.

### 4. Storage

Two new tables (migrations-as-constants; **`workflows` before `workflow_runs`** in `ALL_MIGRATIONS`
for the FK), each with a hand-written repository re-exported from `src/lib/storage/index.ts`.

```
workflows      id, name, description, nodes (JSON: RFNode[]), edges (JSON: RFEdge[]),
               created_at, updated_at
workflow_runs  id, workflow_id (FK), status, input (JSON), result (JSON),
               node_states (JSON), started_at, finished_at
```

`nodes`/`edges` store the React Flow graph (node `data` carries each node's `type` + `config`). The
engine reads a normalized graph derived from these rows.

### 5. Events

New `AppEvent` variants (added to the union in `event-bus.ts` — the only registration step):
- `workflow:run-started` `{ runId, workflowId }`
- `workflow:node-status` `{ runId, nodeId, status, detail? }`
- `workflow:run-finished` `{ runId, status, result? }`

Consumer hooks (`useWorkflowRun(runId)`) derive live editor overlays + the run panel, following the
existing subscribe-in-`useEffect`-return-unsubscribe pattern.

### 6. UI

- **Sidebar "Workflows"** → `WorkflowsPanel` (`src/components/workflows/`): list saved workflows
  (`WorkflowRepository.findAll`), New/duplicate/delete, open one.
- **`WorkflowEditor`**: a **dedicated React Flow canvas** (its own `nodeTypes` from
  `WORKFLOW_NODE_REGISTRY`, separate from the agent canvas), with:
  - **left palette** — node types from the registry (drag/click to add);
  - **center canvas** — nodes with typed port handles; edges connect ports;
  - **right config rail** — the selected node's `ConfigPanel`;
  - **top bar** — name, Save, **Run** (opens a Start-input modal), live run status.
- **Run feedback** — per-node status color/badge from `workflow:node-status`; a results panel showing
  the `output` node's value; errors surfaced on the failing node.
- Hand-rolled **zinc/indigo** styling per the UI conventions (no `components/ui/*`); `workflows/` uses
  the folder's export convention (match a sibling).

---

## Staged build (each = its own `writing-plans` plan + PR + QA gates)

### W1 — Core engine + editor (no control flow)
- `workflows` + `workflow_runs` tables + repositories (+ barrel re-export).
- `WorkflowNodeDef` interface + `WORKFLOW_NODE_REGISTRY` (+ its exhaustive registry test).
- Engine: validate + readiness execution (sequential + parallel + `join`), no `conditional`/`loop`.
- Node types: `start`, `agent`, `tool`, `output` (+ `join`).
- `workflow:*` events + `useWorkflowRun` hook.
- `WorkflowsPanel` + `WorkflowEditor` (palette, port edges, config rail, Save, Run modal, live status),
  wired into `page.tsx` under the Workflows nav.
- **Acceptance:** create, save, reload, and **run** a workflow such as `start → agent → output` and a
  parallel `start → (agent A, tool B) → join → output`, with live per-node status and a final result.
  Web-mode smoke covers the editor; a real agent/tool run is desktop-gated (checklist).

### W2 — Control flow
- `conditional`, `loop`, `transform` node types + engine support (branch pruning, bounded iteration,
  constrained transform expression).
- **Acceptance:** a workflow with a branch (`conditional`) and an array `loop` executes correctly;
  unit tests cover branch pruning + per-item iteration + the transform whitelist (no `eval`).

### W3 — Data-wiring UX + run history
- Editor port-type validation/affordances (incompatible-port connection feedback), run-history view
  over `workflow_runs`, re-run, and polish.
- **Acceptance:** invalid wirings are blocked/flagged in the editor; past runs are listed and viewable.

---

## Verification (per sub-phase)

Same gates as Phases 3–5, run from the worktree (not the main checkout):
`npx tsc --noEmit` · `npx vitest run` · `npx eslint <changed>` (no new errors) · `npm run build`
(static export must stay green) · the four exhaustive registry tests untouched except the **new**
workflow-node registry test (W1 genuinely adds a registry) · an agent smoke test (web-mode editor +
a `tauri:dev` desktop checklist for real agent/tool/MCP execution inside a workflow).

## Risks / notes

- **`eval` is banned** for `transform`/`conditional` predicates — use a constrained expression/template
  evaluator (security §9.3 zero-trust). Implementing that safely is part of W2.
- **Loops must be bounded** (iteration cap) to prevent runaway in-process execution.
- **Desktop ceiling:** as with Phases 3–5, real agent/tool/MCP execution inside a workflow needs a
  `tauri:dev` run; the editor + engine logic are unit/web verifiable.
- **No new heavy deps:** reuse `reactflow`; avoid pulling a node-only graph/runtime library into the
  static bundle.
