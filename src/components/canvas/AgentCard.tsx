'use client'
import { cn } from '@/lib/utils'
import { ActionFeed, type ActionEntry } from './ActionFeed'
import { ApprovalGate } from '../approval/ApprovalGate'
import { useAgentStatus } from '@/hooks/useAgentStatus'
import type { ApprovalRequest } from '@/lib/interfaces'

const STATUS_STYLES = {
  'idle': { border: 'border-white/[0.08]', header: '', dot: 'bg-zinc-600', dotExtra: '', label: 'IDLE', labelColor: 'text-zinc-600' },
  'running': { border: 'border-emerald-500/30', header: '', dot: 'bg-emerald-400', dotExtra: 'shadow-[0_0_8px_rgba(52,211,153,0.6)]', label: 'RUNNING', labelColor: 'text-emerald-400' },
  'awaiting-approval': { border: 'border-amber-500/30', header: '', dot: 'bg-amber-400', dotExtra: 'animate-pulse', label: 'APPROVAL NEEDED', labelColor: 'text-amber-400' },
  'error': { border: 'border-red-500/30', header: '', dot: 'bg-red-400', dotExtra: '', label: 'ERROR', labelColor: 'text-red-400' },
  'stopped': { border: 'border-white/[0.08]', header: '', dot: 'bg-zinc-600', dotExtra: '', label: 'STOPPED', labelColor: 'text-zinc-600' },
}

interface AgentCardProps {
  agentId: string
  name: string
  icon: string
  modelName: string
  toolCount: number
  actions: ActionEntry[]
  pendingApprovals?: ApprovalRequest[]
  onApprove: (requestId: string) => void
  onDeny: (requestId: string) => void
  onOpen: () => void
  onEdit?: () => void
}

export function AgentCard({ agentId, name, icon, modelName, toolCount, actions, pendingApprovals = [], onApprove, onDeny, onOpen, onEdit }: AgentCardProps) {
  const status = useAgentStatus(agentId)
  const style = STATUS_STYLES[status]

  return (
    <div
      className={cn('w-64 rounded-2xl bg-white/[0.04] backdrop-blur border overflow-hidden cursor-default select-none shadow-xl shadow-black/30', style.border)}
      onDoubleClick={onOpen}
    >
      {/* Drag handle dots */}
      <div className="flex justify-center gap-1 pt-2 pb-0">
        {[0,1,2].map(i => <div key={i} className="w-1 h-1 rounded-full bg-white/[0.12]" />)}
      </div>
      {/* Header: name + status */}
      <div className="px-4 pt-2 pb-1 flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-zinc-100 leading-snug">{icon} <span>{name}</span></p>
          <p className="text-[10px] text-zinc-500 mt-0.5">{modelName} · {toolCount} tools</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
          <button
            type="button"
            aria-label="Edit agent"
            className="text-zinc-500 hover:text-zinc-300 text-[12px] leading-none px-1 -mr-1 transition-colors"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onEdit?.() }}
          >
            ✎
          </button>
          <span className={cn('w-2 h-2 rounded-full shrink-0', style.dot, style.dotExtra)} />
          <span className={cn('text-[9px] font-semibold tracking-wide uppercase', style.labelColor)}>{style.label}</span>
        </div>
      </div>
      {/* Action feed */}
      <div className="px-3 pb-3">
        <div className="bg-black/20 rounded-xl p-2 mt-2">
          <ActionFeed actions={actions} />
        </div>
      </div>
      {/* Approval gates */}
      {pendingApprovals.map(req => (
        <ApprovalGate key={req.id} request={req} onApprove={onApprove} onDeny={onDeny} />
      ))}
    </div>
  )
}
