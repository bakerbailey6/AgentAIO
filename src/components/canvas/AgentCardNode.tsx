// src/components/canvas/AgentCardNode.tsx
'use client'
import { Handle, Position, type NodeProps } from 'reactflow'
import { AgentCard } from './AgentCard'
import { useApprovals } from '@/hooks/useApprovals'
import { useAgentActions } from '@/hooks/useAgentActions'
import { AGENT_REGISTRY, resolveAgentRuntimeType } from '@/lib/agents/registry'
import { getEventBus } from '@/lib/event-bus'
import type { CanvasNode } from '@/lib/interfaces'

export interface AgentNodeData {
  label: string
  agentId: string
  name: string
  icon: string
  modelName: string
  toolCount: number
  agentType: string
  onOpenChat: () => void
  onEdit?: () => void
  [key: string]: unknown
}

export function AgentCardNode({ data }: NodeProps<AgentNodeData>) {
  const approvals = useApprovals().filter((a) => a.agentId === data.agentId)
  const provider = AGENT_REGISTRY.get(resolveAgentRuntimeType(data.agentType))
  const rawActions = useAgentActions(data.agentId)

  const handleApprove = (requestId: string) => {
    provider?.approve(requestId)
    getEventBus().emit({
      type: 'agent:approval-resolved',
      requestId,
      approved: true,
      timestamp: Date.now(),
    })
  }

  const handleDeny = (requestId: string) => {
    provider?.deny(requestId)
    getEventBus().emit({
      type: 'agent:approval-resolved',
      requestId,
      approved: false,
      timestamp: Date.now(),
    })
  }

  const actions = rawActions.map((entry, i) => ({
    id: `${entry.timestamp}-${i}`,
    text: entry.detail,
    type: 'info' as const,
    timestamp: entry.timestamp,
  }))

  return (
    <div className="relative">
      <Handle type="target" position={Position.Left} className="w-2.5 h-2.5 bg-violet-600 border-2 border-[#0d0e18]" />
      <AgentCard
        agentId={data.agentId}
        name={data.name}
        icon={data.icon}
        modelName={data.modelName}
        toolCount={data.toolCount}
        actions={actions}
        pendingApprovals={approvals}
        onApprove={handleApprove}
        onDeny={handleDeny}
        onOpen={data.onOpenChat}
        onEdit={data.onEdit}
      />
      <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 bg-violet-600 border-2 border-[#0d0e18]" />
    </div>
  )
}

export const AgentCardNodeDef: CanvasNode<AgentNodeData> = {
  nodeType: 'agentCard',
  defaultData(): AgentNodeData {
    return { label: 'New Agent', agentId: '', name: '', icon: '🤖', modelName: '', toolCount: 0, agentType: '', onOpenChat: () => {}, onEdit: () => {} }
  },
  CardComponent: AgentCardNode,
}
