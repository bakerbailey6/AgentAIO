/**
 * In-process workflow execution engine (readiness scheduler).
 *
 * Given a normalized {@link WorkflowGraph}, the engine validates it, seeds the
 * single `start` node with the run input, and then repeatedly runs every node
 * whose dependencies have completed — all currently-ready nodes execute
 * **concurrently** (`Promise.all`), so independent branches of a diamond run in
 * parallel and a `join` waits for both. A node is **ready** once every incoming
 * edge's source node is `done` and has produced a value for that edge's
 * `sourcePort`; its inputs are gathered by edge (`inputs[targetPort] =
 * sourceOutput[sourcePort]`). A node that throws is marked `error` and its
 * dependents are never scheduled (they remain `pending`).
 *
 * The engine is registry-agnostic: the caller passes the
 * `Map<type, WorkflowNodeDef>` in {@link RunWorkflowOpts.registry} (the editor
 * passes `WORKFLOW_NODE_REGISTRY`, tests pass a fake), so the engine never
 * imports the node-registry module and can be unit-tested in isolation.
 *
 * W1 scope: sequential + parallel + join only. Conditional/loop control flow is
 * W2 and is not handled here.
 *
 * @module
 */
import type { WorkflowNodeDef, PermissionScope, NodeRunStatus } from '@/lib/interfaces'
import { getEventBus } from '@/lib/event-bus'
import { validateGraph, type WorkflowGraph, type WorkflowNode } from './graph'

/** Outcome of a single {@link runWorkflow} call. */
export interface WorkflowRunResult {
  status: 'done' | 'error'
  /** The inputs gathered for the `output` node, or `null` if it never ran. */
  output: Record<string, unknown> | null
  /** Per-node terminal state, keyed by node id. */
  nodeStates: Record<
    string,
    { status: NodeRunStatus; output?: Record<string, unknown>; error?: string }
  >
}

/** Options controlling a workflow run. `registry` is required — the caller owns it. */
export interface RunWorkflowOpts {
  runId: string
  permissionScope: PermissionScope
  registry: Map<string, WorkflowNodeDef>
}

/** Mutable per-node tracking used while scheduling. */
interface NodeState {
  status: NodeRunStatus
  output?: Record<string, unknown>
  error?: string
  /** True once the node has been picked up for execution (avoid double-scheduling). */
  started: boolean
}

/**
 * Execute `graph` end to end and resolve with the terminal {@link WorkflowRunResult}.
 *
 * Never rejects: a structurally invalid graph (or any thrown error) resolves to
 * `{ status: 'error', … }`. Emits `workflow:run-started` first and
 * `workflow:run-finished` last; per-node `workflow:node-status` events bracket
 * each execution.
 */
export async function runWorkflow(
  graph: WorkflowGraph,
  input: unknown,
  opts: RunWorkflowOpts,
): Promise<WorkflowRunResult> {
  const bus = getEventBus()
  const { runId, permissionScope, registry } = opts

  bus.emit({ type: 'workflow:run-started', runId, workflowId: '', timestamp: Date.now() })

  // Validate before touching any node. A bad graph is an immediate run error.
  try {
    validateGraph(graph)
  } catch {
    bus.emit({ type: 'workflow:run-finished', runId, status: 'error', timestamp: Date.now() })
    return { status: 'error', output: null, nodeStates: {} }
  }

  const nodesById = new Map<string, WorkflowNode>()
  for (const node of graph.nodes) nodesById.set(node.id, node)

  // Incoming edges per target node, for both readiness checks and input gathering.
  const incoming = new Map<string, WorkflowGraph['edges']>()
  for (const node of graph.nodes) incoming.set(node.id, [])
  for (const edge of graph.edges) incoming.get(edge.target)?.push(edge)

  const states = new Map<string, NodeState>()
  for (const node of graph.nodes) states.set(node.id, { status: 'pending', started: false })

  // The `start` node is seeded with the run input under a reserved key.
  const startNode = graph.nodes.find((n) => n.type === 'start')!
  const seededInputs = new Map<string, Record<string, unknown>>()
  seededInputs.set(startNode.id, { __runInput: input })

  /**
   * A node is ready when it hasn't started and every incoming edge's source has
   * completed (`done`) and produced a value for that edge's `sourcePort`.
   */
  const isReady = (nodeId: string): boolean => {
    const state = states.get(nodeId)!
    if (state.started) return false
    for (const edge of incoming.get(nodeId) ?? []) {
      const src = states.get(edge.source)
      if (!src || src.status !== 'done') return false
      if (!src.output || !(edge.sourcePort in src.output)) return false
    }
    return true
  }

  /** Gather a node's inputs from its incoming edges (plus any seeded values). */
  const gatherInputs = (nodeId: string): Record<string, unknown> => {
    const inputs: Record<string, unknown> = { ...(seededInputs.get(nodeId) ?? {}) }
    for (const edge of incoming.get(nodeId) ?? []) {
      const src = states.get(edge.source)
      if (src?.output && edge.sourcePort in src.output) {
        inputs[edge.targetPort] = src.output[edge.sourcePort]
      }
    }
    return inputs
  }

  /** Run a single node: emit running, execute, store outputs, emit done/error. */
  const runNode = async (node: WorkflowNode): Promise<void> => {
    const state = states.get(node.id)!
    state.started = true
    state.status = 'running'
    bus.emit({
      type: 'workflow:node-status',
      runId,
      nodeId: node.id,
      status: 'running',
      timestamp: Date.now(),
    })

    const inputs = gatherInputs(node.id)
    const report = (status: NodeRunStatus, detail?: string): void => {
      bus.emit({
        type: 'workflow:node-status',
        runId,
        nodeId: node.id,
        status,
        detail,
        timestamp: Date.now(),
      })
    }

    try {
      const def = registry.get(node.type)
      if (!def || typeof def.execute !== 'function') {
        throw new Error(`No executable node def registered for type "${node.type}".`)
      }
      const out = await def.execute(
        { inputs, nodeId: node.id, runId, permissionScope, report },
        node.config,
      )
      state.output = out
      state.status = 'done'
      bus.emit({
        type: 'workflow:node-status',
        runId,
        nodeId: node.id,
        status: 'done',
        timestamp: Date.now(),
      })
    } catch (err) {
      state.status = 'error'
      state.error = err instanceof Error ? err.message : String(err)
      bus.emit({
        type: 'workflow:node-status',
        runId,
        nodeId: node.id,
        status: 'error',
        detail: state.error,
        timestamp: Date.now(),
      })
    }
  }

  // Readiness loop: run every currently-ready node concurrently, then recompute
  // the frontier. A node that errored never satisfies `isReady` for its
  // dependents, so failed branches stall (dependents stay `pending`).
  for (;;) {
    const ready = graph.nodes.filter((n) => isReady(n.id))
    if (ready.length === 0) break
    await Promise.all(ready.map((n) => runNode(n)))
  }

  // The output node's gathered inputs are the run's output (if it ran).
  const outputNode = graph.nodes.find((n) => n.type === 'output')
  let output: Record<string, unknown> | null = null
  if (outputNode && states.get(outputNode.id)!.status === 'done') {
    output = gatherInputs(outputNode.id)
  }

  const anyError = [...states.values()].some((s) => s.status === 'error')
  const status: 'done' | 'error' = anyError ? 'error' : 'done'

  const nodeStates: WorkflowRunResult['nodeStates'] = {}
  for (const [id, s] of states) {
    nodeStates[id] = { status: s.status, output: s.output, error: s.error }
  }

  const result: WorkflowRunResult = { status, output, nodeStates }
  bus.emit({ type: 'workflow:run-finished', runId, status, result, timestamp: Date.now() })
  return result
}
