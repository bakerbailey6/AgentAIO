import type { ComponentType } from 'react'
import type { NodeProps } from 'reactflow'

export interface CanvasNodeData {
  label: string
  [key: string]: unknown
}

export interface CanvasNode<TData extends CanvasNodeData = CanvasNodeData> {
  readonly nodeType: string
  defaultData(): TData
  CardComponent: ComponentType<NodeProps<TData>>
}
