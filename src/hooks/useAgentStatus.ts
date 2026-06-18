import { useState, useEffect } from 'react'
import { getEventBus } from '@/lib/event-bus'
import type { AgentStatus, AgentStatusChangedEvent } from '@/lib/interfaces'

export function useAgentStatus(agentId: string): AgentStatus {
  const [status, setStatus] = useState<AgentStatus>('idle')

  useEffect(() => {
    const unsub = getEventBus().on('agent:status-changed', (event: AgentStatusChangedEvent) => {
      if (event.agentId === agentId) setStatus(event.status)
    })
    return unsub
  }, [agentId])

  return status
}
