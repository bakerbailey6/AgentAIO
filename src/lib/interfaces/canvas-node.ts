/**
 * The canvas node contract.
 *
 * Every kind of card that can appear on the React Flow canvas — agent, group,
 * future note/workflow — implements {@link CanvasNode}. The definition pairs a
 * stable `nodeType` with a React component and a factory for its initial data.
 * Node definitions are collected in `NODE_REGISTRY` (`src/lib/canvas/node-registry.ts`)
 * and handed to React Flow as its `nodeTypes` map.
 *
 * @module
 */
import type { ComponentType } from 'react'
import type { NodeProps } from 'reactflow'

/** Base shape for any node's data; `label` is always present. */
export interface CanvasNodeData {
  label: string
  [key: string]: unknown
}

/**
 * Registers a renderable card type with the canvas.
 *
 * @typeParam TData - The node's data shape; defaults to {@link CanvasNodeData}.
 */
export interface CanvasNode<TData extends CanvasNodeData = CanvasNodeData> {
  /** Stable type key matching React Flow's `node.type`. */
  readonly nodeType: string
  /** Produce the initial data for a freshly created node. */
  defaultData(): TData
  /** The React component React Flow renders for this node type. */
  CardComponent: ComponentType<NodeProps<TData>>
}
