'use client'
import { useState, useEffect, useRef } from 'react'
import { getEventBus } from '@/lib/event-bus'
import type { AgentStatus, AgentStatusChangedEvent } from '@/lib/interfaces'

export function useAgentCounts() {
  const statusMap = useRef<Map<string, AgentStatus>>(new Map())
  const [counts, setCounts] = useState({ running: 0, idle: 0, awaitingApproval: 0 })

  useEffect(() => {
    function derive() {
      let running = 0, idle = 0, awaitingApproval = 0
      for (const s of statusMap.current.values()) {
        if (s === 'running') running++
        else if (s === 'idle') idle++
        else if (s === 'awaiting-approval') awaitingApproval++
      }
      setCounts({ running, idle, awaitingApproval })
    }

    const unsub = getEventBus().on('agent:status-changed', (event: AgentStatusChangedEvent) => {
      statusMap.current.set(event.agentId, event.status)
      derive()
    })
    return unsub
  }, [])

  return counts
}
