/**
 * Registry of {@link CanvasNode} definitions, keyed by `nodeType`.
 *
 * The canvas calls {@link getNodeTypes} to hand React Flow its `nodeTypes` map.
 * Built-in node types are registered at module load (bottom of this file); add a
 * new card type by implementing `CanvasNode` and {@link registerCanvasNode}.
 *
 * @module
 */
import type { ComponentType } from 'react'
import type { NodeProps } from 'reactflow'
import type { CanvasNode } from '@/lib/interfaces'
import { AgentCardNodeDef } from '@/components/canvas/AgentCardNode'
import { GroupNodeDef } from '@/components/canvas/GroupNode'

export const NODE_REGISTRY = new Map<string, CanvasNode>()

/** Register (or replace) a canvas node definition under its `nodeType`. */
export function registerCanvasNode(node: CanvasNode): void {
  NODE_REGISTRY.set(node.nodeType, node)
}

/**
 * Build the `nodeType → component` map React Flow expects, from the registry.
 */
export function getNodeTypes(): Record<string, ComponentType<NodeProps>> {
  const types: Record<string, ComponentType<NodeProps>> = {}
  NODE_REGISTRY.forEach((node, key) => {
    types[key] = node.CardComponent as ComponentType<NodeProps>
  })
  return types
}

// Register built-in node types
registerCanvasNode(AgentCardNodeDef as unknown as CanvasNode)
registerCanvasNode(GroupNodeDef as unknown as CanvasNode)
