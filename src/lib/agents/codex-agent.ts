import type { AgentProvider, AgentEvent, AgentSession, AgentCapabilities } from '@/lib/interfaces'
export class CodexAgentProvider implements AgentProvider {
  readonly type = 'codex'
  readonly displayName = 'OpenAI Codex'
  readonly icon = '⚡'
  async configure(): Promise<void> {}
  async *run(_session: AgentSession, _input: string): AsyncIterable<AgentEvent> {}
  async stop(): Promise<void> {}
  async approve(): Promise<void> {}
  async deny(): Promise<void> {}
  getCapabilities(): AgentCapabilities {
    return { supportsTools: true, supportsStreaming: true, supportsApprovalGates: true, requiresProjectDirectory: true }
  }
}
