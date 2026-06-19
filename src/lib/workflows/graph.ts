/**
 * Normalized workflow graph types + builder/validator.
 *
 * The React Flow editor works with its own node/edge shapes (`node.data` carries
 * `{ type, config }`; edges carry `sourceHandle`/`targetHandle` for the connected
 * ports). {@link normalizeGraph} flattens those rows into the persistence-/engine-
 * facing {@link WorkflowGraph}, and {@link validateGraph} enforces the structural
 * invariants the engine relies on (a single entry point, a sink, well-formed edges,
 * and acyclicity).
 *
 * @module
 */
import type { NodeConfig } from '@/lib/interfaces'

/** A node in the normalized graph: stable id, def `type`, and its persisted config. */
export interface WorkflowNode {
  id: string
  type: string
  config: NodeConfig
}

/** A directed connection from one node's output port to another node's input port. */
export interface WorkflowEdge {
  id: string
  source: string
  sourcePort: string
  target: string
  targetPort: string
}

/** The full normalized graph the engine executes and the repository persists. */
export interface WorkflowGraph {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

/**
 * Flatten React Flow rows into a normalized {@link WorkflowGraph}.
 *
 * A node's `data.type` becomes the node `type`; a missing `data.config` defaults to
 * `{}`. An edge's `sourceHandle`/`targetHandle` become `sourcePort`/`targetPort`,
 * defaulting to `''` when null/undefined.
 */
export function normalizeGraph(
  rfNodes: Array<{ id: string; data: { type: string; config?: NodeConfig } }>,
  rfEdges: Array<{
    id: string
    source: string
    target: string
    sourceHandle?: string | null
    targetHandle?: string | null
  }>,
): WorkflowGraph {
  return {
    nodes: rfNodes.map((n) => ({
      id: n.id,
      type: n.data.type,
      config: n.data.config ?? {},
    })),
    edges: rfEdges.map((e) => ({
      id: e.id,
      source: e.source,
      sourcePort: e.sourceHandle ?? '',
      target: e.target,
      targetPort: e.targetHandle ?? '',
    })),
  }
}

/**
 * Throw an {@link Error} with a clear message if `graph` is structurally invalid;
 * return `void` if it is OK.
 *
 * Rules: exactly one `start` node; at least one `output` node; every edge's `source`
 * and `target` must reference an existing node id; the directed graph must be acyclic.
 */
export function validateGraph(graph: WorkflowGraph): void {
  const startCount = graph.nodes.filter((n) => n.type === 'start').length
  if (startCount !== 1) {
    throw new Error(`Workflow must have exactly one start node (found ${startCount}).`)
  }

  const hasOutput = graph.nodes.some((n) => n.type === 'output')
  if (!hasOutput) {
    throw new Error('Workflow must have at least one output node.')
  }

  const nodeIds = new Set(graph.nodes.map((n) => n.id))
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.source)) {
      throw new Error(`Edge "${edge.id}" references a missing source node "${edge.source}".`)
    }
    if (!nodeIds.has(edge.target)) {
      throw new Error(`Edge "${edge.id}" references a missing target node "${edge.target}".`)
    }
  }

  detectCycle(graph)
}

/** DFS over the directed edges; throws if a back-edge (cycle) is found. */
function detectCycle(graph: WorkflowGraph): void {
  const adjacency = new Map<string, string[]>()
  for (const node of graph.nodes) adjacency.set(node.id, [])
  for (const edge of graph.edges) {
    adjacency.get(edge.source)?.push(edge.target)
  }

  // 0 = unvisited, 1 = on the current DFS stack, 2 = fully explored.
  const state = new Map<string, 0 | 1 | 2>()
  for (const node of graph.nodes) state.set(node.id, 0)

  const visit = (id: string): void => {
    state.set(id, 1)
    for (const next of adjacency.get(id) ?? []) {
      const s = state.get(next)
      if (s === 1) {
        throw new Error(`Workflow graph contains a cycle (at node "${next}").`)
      }
      if (s === 0) visit(next)
    }
    state.set(id, 2)
  }

  for (const node of graph.nodes) {
    if (state.get(node.id) === 0) visit(node.id)
  }
}
