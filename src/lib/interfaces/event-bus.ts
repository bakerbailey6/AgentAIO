import type { AgentEvent, AgentStatus, ApprovalRequest } from './agent-provider'

export interface AgentStatusChangedEvent {
  type: 'agent:status-changed'
  agentId: string
  status: AgentStatus
  timestamp: number
}

export interface AgentActionEvent {
  type: 'agent:action'
  agentId: string
  action: string
  detail: string
  timestamp: number
}

export interface AgentApprovalRequestedEvent {
  type: 'agent:approval-requested'
  request: ApprovalRequest
  timestamp: number
}

export interface AgentApprovalResolvedEvent {
  type: 'agent:approval-resolved'
  requestId: string
  approved: boolean
  timestamp: number
}

export interface CanvasLayoutChangedEvent {
  type: 'canvas:layout-changed'
  timestamp: number
}

export type AppEvent =
  | AgentStatusChangedEvent
  | AgentActionEvent
  | AgentApprovalRequestedEvent
  | AgentApprovalResolvedEvent
  | CanvasLayoutChangedEvent

export type Unsubscribe = () => void

export interface EventBus {
  emit<T extends AppEvent>(event: T): void
  on<T extends AppEvent>(type: T['type'], handler: (event: T) => void): Unsubscribe
  off<T extends AppEvent>(type: T['type'], handler: (event: T) => void): void
}
