'use client'
import { cn } from '@/lib/utils'
import { ActionFeed, type ActionEntry } from './ActionFeed'
import { ApprovalGate } from '../approval/ApprovalGate'
import { useAgentStatus } from '@/hooks/useAgentStatus'
import type { ApprovalRequest } from '@/lib/interfaces'

const STATUS_STYLES = {
  'idle': { border: 'border-neutral-700', header: 'bg-[#141420]', dot: 'bg-neutral-500', label: 'IDLE', labelColor: 'text-neutral-500' },
  'running': { border: 'border-green-500', header: 'bg-[#0e1a12]', dot: 'bg-green-400', label: 'RUNNING', labelColor: 'text-green-400' },
  'awaiting-approval': { border: 'border-red-500', header: 'bg-[#1a0c0e]', dot: 'bg-red-400', label: 'APPROVAL NEEDED', labelColor: 'text-red-400' },
  'error': { border: 'border-red-700', header: 'bg-[#1a0808]', dot: 'bg-red-600', label: 'ERROR', labelColor: 'text-red-600' },
  'stopped': { border: 'border-neutral-700', header: 'bg-[#141420]', dot: 'bg-neutral-600', label: 'STOPPED', labelColor: 'text-neutral-600' },
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
}

export function AgentCard({ agentId, name, icon, modelName, toolCount, actions, pendingApprovals = [], onApprove, onDeny, onOpen }: AgentCardProps) {
  const status = useAgentStatus(agentId)
  const style = STATUS_STYLES[status]

  return (
    <div
      className={cn('w-[200px] rounded-[10px] bg-[#12131e] border overflow-hidden cursor-default select-none', style.border)}
      onDoubleClick={onOpen}
    >
      {/* Drag handle dots */}
      <div className="flex justify-center gap-1 pt-1.5 pb-0">
        {[0,1,2].map(i => <div key={i} className="w-1 h-1 rounded-full bg-neutral-700" />)}
      </div>
      {/* Status header */}
      <div className={cn('flex items-center gap-2 px-3 py-1.5', style.header)}>
        <span className={cn('w-2 h-2 rounded-full shrink-0', style.dot)} />
        <span className={cn('text-[9px] font-bold tracking-wide flex-1', style.labelColor)}>{style.label}</span>
      </div>
      {/* Name + model */}
      <div className="px-3 pt-2 pb-1">
        <p className="text-[14px] font-bold">{icon} <span>{name}</span></p>
        <p className="text-[10px] text-neutral-600">{modelName} · {toolCount} tools</p>
      </div>
      {/* Action feed */}
      <div className="px-2 pb-2">
        <ActionFeed actions={actions} />
      </div>
      {/* Approval gates */}
      {pendingApprovals.map(req => (
        <ApprovalGate key={req.id} request={req} onApprove={onApprove} onDeny={onDeny} />
      ))}
    </div>
  )
}
