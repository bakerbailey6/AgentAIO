// src/lib/agents/llm-agent.ts
import { streamText } from 'ai'
import type { AgentProvider, AgentEvent, AgentSession, AgentCapabilities } from '@/lib/interfaces'
import { LLMRouter } from '@/lib/llm/router'

export interface LLMAgentConfig {
  modelId: string
  systemPrompt: string
  toolIds: string[]
  mcpIds: string[]
}

let _router: LLMRouter | undefined
function getRouter(): LLMRouter {
  if (!_router) _router = new LLMRouter()
  return _router
}
const pendingApprovals = new Map<string, { resolve: (approved: boolean) => void }>()

export class LLMAgentProvider implements AgentProvider<LLMAgentConfig, AgentEvent> {
  readonly type = 'llm'
  readonly displayName = 'LLM Agent'
  readonly icon = '🤖'

  async configure(_config: LLMAgentConfig): Promise<void> {}

  async *run(session: AgentSession, input: string): AsyncIterable<AgentEvent> {
    const model = await getRouter().getAdapter(session.agentId)

    yield {
      type: 'status-change',
      agentId: session.agentId,
      timestamp: Date.now(),
      payload: { status: 'running' },
    }

    const result = streamText({ model, prompt: input })

    for await (const chunk of result.fullStream) {
      if (chunk.type === 'text-delta') {
        yield {
          type: 'text-delta',
          agentId: session.agentId,
          timestamp: Date.now(),
          payload: { delta: chunk.text },
        }
      }
    }

    yield {
      type: 'status-change',
      agentId: session.agentId,
      timestamp: Date.now(),
      payload: { status: 'idle' },
    }
  }

  async stop(sessionId: string): Promise<void> {
    pendingApprovals.get(sessionId)?.resolve(false)
    pendingApprovals.delete(sessionId)
  }

  async approve(requestId: string): Promise<void> {
    pendingApprovals.get(requestId)?.resolve(true)
  }

  async deny(requestId: string): Promise<void> {
    pendingApprovals.get(requestId)?.resolve(false)
  }

  getCapabilities(): AgentCapabilities {
    return {
      supportsTools: true,
      supportsStreaming: true,
      supportsApprovalGates: true,
      requiresProjectDirectory: false,
    }
  }
}
