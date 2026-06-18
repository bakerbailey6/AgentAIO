// src/lib/canvas/node-registry.ts
import type { ComponentType } from 'react'
import type { NodeProps } from 'reactflow'
import type { CanvasNode } from '@/lib/interfaces'
import { AgentCardNodeDef } from '@/components/canvas/AgentCardNode'
import { GroupNodeDef } from '@/components/canvas/GroupNode'

export const NODE_REGISTRY = new Map<string, CanvasNode>()

export function registerCanvasNode(node: CanvasNode): void {
  NODE_REGISTRY.set(node.nodeType, node)
}

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
