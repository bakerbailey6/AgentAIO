import { useState, useEffect } from 'react'
import { getEventBus } from '@/lib/event-bus'
import type { ApprovalRequest, AgentApprovalRequestedEvent, AgentApprovalResolvedEvent } from '@/lib/interfaces'

export function useApprovals(): ApprovalRequest[] {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([])

  useEffect(() => {
    const unsubRequest = getEventBus().on(
      'agent:approval-requested',
      (event: AgentApprovalRequestedEvent) => {
        setApprovals((prev) => [...prev, event.request])
      },
    )
    const unsubResolved = getEventBus().on(
      'agent:approval-resolved',
      (event: AgentApprovalResolvedEvent) => {
        setApprovals((prev) => prev.filter((a) => a.id !== event.requestId))
      },
    )
    return () => {
      unsubRequest()
      unsubResolved()
    }
  }, [])

  return approvals
}
