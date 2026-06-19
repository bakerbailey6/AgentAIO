import { useState, useEffect } from 'react'
import { getEventBus } from '@/lib/event-bus'
import type { AgentStatus, AgentStatusChangedEvent } from '@/lib/interfaces'

/**
 * Track one agent's live {@link AgentStatus} by subscribing to the event bus.
 *
 * Starts at `'idle'` and updates whenever a `agent:status-changed` event for
 * `agentId` arrives. Used by the agent card to drive its status glow.
 */
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
