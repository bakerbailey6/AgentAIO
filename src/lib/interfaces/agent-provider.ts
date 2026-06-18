import type { NodeProps } from 'reactflow'

export type AgentStatus = 'idle' | 'running' | 'awaiting-approval' | 'error' | 'stopped'

export interface AgentEvent {
  type: 'tool-call' | 'tool-result' | 'text-delta' | 'approval-request' | 'status-change' | 'error'
  agentId: string
  timestamp: number
  payload: unknown
}

export interface ApprovalRequest {
  id: string
  agentId: string
  action: string
  description: string
  risk: 'low' | 'medium' | 'high'
}

export interface AgentCapabilities {
  supportsTools: boolean
  supportsStreaming: boolean
  supportsApprovalGates: boolean
  requiresProjectDirectory: boolean
}

export interface AgentSession {
  id: string
  agentId: string
  projectDirectory?: string
  permissionScope: PermissionScope
}

export interface PermissionScope {
  allowedPaths: string[]
  allowedDomains: string[]
  shellEnabled: boolean
}

export interface AgentProvider<TConfig = unknown, TEvent extends AgentEvent = AgentEvent> {
  readonly type: string
  readonly displayName: string
  readonly icon: string
  configure(config: TConfig): Promise<void>
  run(session: AgentSession, input: string): AsyncIterable<TEvent>
  stop(sessionId: string): Promise<void>
  approve(requestId: string): Promise<void>
  deny(requestId: string, reason?: string): Promise<void>
  getCapabilities(): AgentCapabilities
}
