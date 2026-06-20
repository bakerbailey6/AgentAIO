/**
 * Port-type compatibility helpers for the workflow editor.
 *
 * These are pure functions used by the editor to validate wirings before
 * committing an edge. A connection is allowed when its source-output and
 * target-input {@link PortType}s are compatible — or when either side can't be
 * resolved (lenient: we never block on unknown ports, e.g. a missing handle or
 * an unregistered node type).
 *
 * @module
 */
import type { PortType, NodeConfig, WorkflowNodeDef } from '@/lib/interfaces'

/** Two port types are compatible if either is `any` or they are equal. */
export function arePortTypesCompatible(source: PortType, target: PortType): boolean {
  return source === 'any' || target === 'any' || source === target
}

/** A node as seen by the editor: an id plus its persisted type + config. */
export interface EditorNodeLike {
  id: string
  data: { type: string; config: NodeConfig }
}

/** A (possibly in-progress) connection between two node handles. */
export interface ConnectionLike {
  source: string
  sourceHandle?: string | null
  target: string
  targetHandle?: string | null
}

/**
 * Resolve a connection's source-output and target-input port types from the
 * graph + registry. Either side is `undefined` if its node, def, or handle
 * can't be resolved.
 */
export function connectionPortTypes(
  nodes: EditorNodeLike[],
  registry: Map<string, WorkflowNodeDef>,
  conn: ConnectionLike,
): { source?: PortType; target?: PortType } {
  const sourceNode = nodes.find((n) => n.id === conn.source)
  const targetNode = nodes.find((n) => n.id === conn.target)

  const source = sourceNode
    ? registry
        .get(sourceNode.data.type)
        ?.ports(sourceNode.data.config)
        .outputs.find((p) => p.name === conn.sourceHandle)?.type
    : undefined

  const target = targetNode
    ? registry
        .get(targetNode.data.type)
        ?.ports(targetNode.data.config)
        .inputs.find((p) => p.name === conn.targetHandle)?.type
    : undefined

  return { source, target }
}

/**
 * True if the connection is type-compatible. Lenient: if either side's type
 * can't be resolved (unknown node, missing def, or unmatched handle), allow it.
 */
export function isConnectionCompatible(
  nodes: EditorNodeLike[],
  registry: Map<string, WorkflowNodeDef>,
  conn: ConnectionLike,
): boolean {
  const { source, target } = connectionPortTypes(nodes, registry, conn)
  if (source === undefined || target === undefined) return true
  return arePortTypesCompatible(source, target)
}
