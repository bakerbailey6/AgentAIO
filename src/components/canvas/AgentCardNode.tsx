// src/components/canvas/AgentCardNode.tsx
'use client'
import { Handle, Position, type NodeProps } from 'reactflow'
import { AgentCard } from './AgentCard'
import { useApprovals } from '@/hooks/useApprovals'
import { AGENT_REGISTRY } from '@/lib/agents/registry'
import type { CanvasNode } from '@/lib/interfaces'

export interface AgentNodeData {
  label: string
  agentId: string
  name: string
  icon: string
  modelName: string
  toolCount: number
  agentType: string
  [key: string]: unknown
}

export function AgentCardNode({ data }: NodeProps<AgentNodeData>) {
  const approvals = useApprovals().filter((a) => a.agentId === data.agentId)
  const provider = AGENT_REGISTRY.get(data.agentType)

  const handleApprove = (requestId: string) => provider?.approve(requestId)
  const handleDeny = (requestId: string) => provider?.deny(requestId)

  return (
    <div className="relative">
      <Handle type="target" position={Position.Left} className="w-2.5 h-2.5 bg-violet-600 border-2 border-[#0d0e18]" />
      <AgentCard
        agentId={data.agentId}
        name={data.name}
        icon={data.icon}
        modelName={data.modelName}
        toolCount={data.toolCount}
        actions={[]}
        pendingApprovals={approvals}
        onApprove={handleApprove}
        onDeny={handleDeny}
        onOpen={() => {}}
      />
      <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 bg-violet-600 border-2 border-[#0d0e18]" />
    </div>
  )
}

export const AgentCardNodeDef: CanvasNode<AgentNodeData> = {
  nodeType: 'agentCard',
  defaultData(): AgentNodeData {
    return { label: 'New Agent', agentId: '', name: '', icon: '🤖', modelName: '', toolCount: 0, agentType: '' }
  },
  CardComponent: AgentCardNode,
}
