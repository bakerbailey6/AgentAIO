import type { AgentProvider, AgentEvent, AgentSession, AgentCapabilities } from '@/lib/interfaces'
export class ClaudeCodeAgentProvider implements AgentProvider {
  readonly type = 'claude-code'
  readonly displayName = 'Claude Code'
  readonly icon = '🧑‍💻'
  async configure(): Promise<void> {}
  async *run(_session: AgentSession, _input: string): AsyncIterable<AgentEvent> {}
  async stop(): Promise<void> {}
  async approve(): Promise<void> {}
  async deny(): Promise<void> {}
  getCapabilities(): AgentCapabilities {
    return { supportsTools: true, supportsStreaming: true, supportsApprovalGates: true, requiresProjectDirectory: true }
  }
}
