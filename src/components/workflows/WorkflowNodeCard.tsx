// src/components/workflows/WorkflowNodeCard.tsx
'use client'
import { Handle, Position, type NodeProps } from 'reactflow'
import { WORKFLOW_NODE_REGISTRY } from '@/lib/workflows/node-registry'
import type { NodeConfig, NodeRunStatus } from '@/lib/interfaces'

/**
 * The single React Flow node type used for every workflow node. The graph stores
 * the *workflow* node type (`start`/`agent`/`tool`/…) in `data.type`; React Flow
 * itself only ever sees this one `nodeType`, mapped to {@link WorkflowNodeCard}.
 */
export const WORKFLOW_NODE_TYPE = 'workflowNode'

/** Data carried on a React Flow node rendered by {@link WorkflowNodeCard}. */
export interface WorkflowNodeCardData {
  /** Workflow node type key — resolved against `WORKFLOW_NODE_REGISTRY`. */
  type: string
  /** Per-instance config (drives `ports()` and execution). */
  config: NodeConfig
  /** Display label for the card. */
  label: string
  /** Live run status, mapped onto a colored ring by the engine/editor overlay. */
  runStatus?: NodeRunStatus
  [key: string]: unknown
}

/** Tailwind ring/border recipe per run status (mirrors AgentCard's status palette). */
const STATUS_RING: Record<NodeRunStatus, string> = {
  pending: 'border-amber-500/30 ring-1 ring-amber-500/20',
  running: 'border-indigo-500/50 ring-2 ring-indigo-500/40 shadow-[0_0_12px_rgba(99,102,241,0.35)]',
  done: 'border-emerald-500/40 ring-1 ring-emerald-500/30',
  error: 'border-red-500/50 ring-2 ring-red-500/30',
}

const DEFAULT_RING = 'border-white/[0.08]'

/**
 * Generic card for any workflow node on the React Flow canvas. Resolves the
 * node's def from `WORKFLOW_NODE_REGISTRY`, renders its `icon` + `data.label`,
 * a left `target` `Handle` per input port and a right `source` `Handle` per
 * output port (each keyed by its port name), and a status ring by `runStatus`.
 */
export function WorkflowNodeCard({ data }: NodeProps<WorkflowNodeCardData>) {
  const def = WORKFLOW_NODE_REGISTRY.get(data.type)
  const { inputs, outputs } = def?.ports(data.config) ?? { inputs: [], outputs: [] }
  const ring = data.runStatus ? STATUS_RING[data.runStatus] : DEFAULT_RING

  return (
    <div
      data-run-status={data.runStatus ?? 'idle'}
      className={`relative w-52 rounded-2xl bg-white/[0.04] backdrop-blur border ${ring} overflow-hidden cursor-default select-none shadow-xl shadow-black/30 transition-colors`}
    >
      {/* input handles, vertically distributed down the left edge */}
      {inputs.map((port, i) => (
        <Handle
          key={`in-${port.name}`}
          type="target"
          position={Position.Left}
          id={port.name}
          className="w-2.5 h-2.5 bg-indigo-500 border-2 border-[#0d0e18]"
          style={{ top: `${((i + 1) / (inputs.length + 1)) * 100}%` }}
        />
      ))}

      <div className="px-4 py-3 flex items-center gap-2.5">
        <span className="text-[18px] leading-none shrink-0" aria-hidden>
          {def?.icon ?? '⬚'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-zinc-100 leading-snug truncate">{data.label}</p>
          <p className="text-[10px] text-zinc-500 mt-0.5 truncate">{def?.label ?? data.type}</p>
        </div>
      </div>

      {/* output handles, vertically distributed down the right edge */}
      {outputs.map((port, i) => (
        <Handle
          key={`out-${port.name}`}
          type="source"
          position={Position.Right}
          id={port.name}
          className="w-2.5 h-2.5 bg-indigo-500 border-2 border-[#0d0e18]"
          style={{ top: `${((i + 1) / (outputs.length + 1)) * 100}%` }}
        />
      ))}
    </div>
  )
}
