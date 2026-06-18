// src/lib/canvas/node-registry.ts
import type { ComponentType } from 'react'
import type { CanvasNode } from '@/lib/interfaces'

export const NODE_REGISTRY = new Map<string, CanvasNode>()

export function registerCanvasNode(node: CanvasNode): void {
  NODE_REGISTRY.set(node.nodeType, node)
}

export function getNodeTypes(): Record<string, ComponentType> {
  const types: Record<string, ComponentType> = {}
  NODE_REGISTRY.forEach((node, key) => {
    types[key] = node.CardComponent as ComponentType
  })
  return types
}
