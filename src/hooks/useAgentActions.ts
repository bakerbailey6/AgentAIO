'use client'
import { useState, useEffect } from 'react'
import { getEventBus } from '@/lib/event-bus'
import type { AgentActionEvent } from '@/lib/interfaces'

export interface ActionEntry {
  action: string
  detail: string
  timestamp: number
}

export function useAgentActions(agentId: string, maxItems = 4): ActionEntry[] {
  const [actions, setActions] = useState<ActionEntry[]>([])

  useEffect(() => {
    setActions([]) // reset when agentId changes
    const unsub = getEventBus().on('agent:action', (event: AgentActionEvent) => {
      if (event.agentId !== agentId) return
      setActions(prev => {
        const next = [...prev, { action: event.action, detail: event.detail, timestamp: event.timestamp }]
        return next.length > maxItems ? next.slice(-maxItems) : next
      })
    })
    return unsub
  }, [agentId, maxItems])

  return actions
}
