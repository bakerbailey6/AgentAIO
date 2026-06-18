// src/components/canvas/GroupNode.tsx
'use client'
import { type NodeProps } from 'reactflow'

export interface GroupNodeData {
  label: string
}

export function GroupNode({ data, selected }: NodeProps<GroupNodeData>) {
  return (
    <div className={`rounded-xl border border-dashed border-violet-500/30 bg-violet-500/3 min-w-[300px] min-h-[200px] ${selected ? 'border-violet-500/60' : ''}`}>
      <div className="px-3 pt-2">
        <span className="text-[11px] font-bold text-violet-400/70 tracking-wide">📁 {data.label}</span>
      </div>
    </div>
  )
}
