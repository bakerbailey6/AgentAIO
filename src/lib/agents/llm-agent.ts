/**
 * The default agent runtime: a streaming LLM chat loop.
 *
 * Resolves the agent's configured model through the {@link LLMRouter}, streams
 * the response with the Vercel AI SDK's `streamText`, and re-emits text deltas
 * as {@link AgentEvent}s for the canvas. Unlike the coding agents it needs no
 * project directory and runs entirely in-process.
 *
 * @module
 */
import { streamText, stepCountIs } from 'ai'
import type { ModelMessage } from 'ai'
import type { AgentProvider, AgentEvent, AgentSession, AgentCapabilities } from '@/lib/interfaces'
import type { ChatMessage } from '@/lib/chat/types'
import { LLMRouter } from '@/lib/llm/router'
import { initDb, AgentRepository, SessionRepository } from '@/lib/storage'
import { resolveCapabilities } from './capabilities'
import { toAiTool } from './tool-adapter'
import { resolveApproval, abortSessionApprovals } from './approval-gate'

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

/** Best-effort human-readable string for an unknown thrown or streamed error. */
function stringifyError(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  try {
    const s = JSON.stringify(err)
    if (s && s !== '{}') return s
  } catch {
    /* fall through to String() */
  }
  return String(err)
}

export class LLMAgentProvider implements AgentProvider<LLMAgentConfig, AgentEvent> {
  readonly type = 'llm'
  readonly displayName = 'LLM Agent'
  readonly icon = '🤖'

  async configure(_config: LLMAgentConfig): Promise<void> {}

  async *run(session: AgentSession, input: string): AsyncIterable<AgentEvent> {
    try {
      const db = await initDb()
      const agentRepo = new AgentRepository(db)
      const agentRow = await agentRepo.findById(session.agentId)
      if (!agentRow?.modelId) throw new Error(`Agent ${session.agentId} has no modelId configured`)
      const model = await getRouter().getAdapter(agentRow.modelId)

      // Build the conversation from the session's persisted history plus the new
      // user input, so the agent has memory across turns — not just the last line.
      const sessionRepo = new SessionRepository(db)
      const sessionRow = await sessionRepo.findById(session.id)
      const history = ((sessionRow?.messages as ChatMessage[] | undefined) ?? []).map(
        (m): ModelMessage =>
          m.role === 'assistant'
            ? { role: 'assistant', content: m.content }
            : { role: 'user', content: m.content },
      )
      const messages: ModelMessage[] = [...history, { role: 'user', content: input }]

      // Resolve the agent's configured capabilities (skills, tools, MCPs). Skill
      // bodies are injected into the system prompt; tools are exposed to the model.
      const caps = await resolveCapabilities(agentRow)
      const system = [agentRow.systemPrompt, ...caps.skillBodies].filter(Boolean).join('\n\n')
      const tools =
        caps.tools.size > 0
          ? Object.fromEntries(
              [...caps.tools].map(([name, def]) => [
                name,
                toAiTool(def, {
                  agentId: session.agentId,
                  sessionId: session.id,
                  permissionScope: session.permissionScope,
                }),
              ]),
            )
          : undefined

      yield {
        type: 'status-change',
        agentId: session.agentId,
        timestamp: Date.now(),
        payload: { status: 'running' },
      }

      const result = streamText({
        model,
        ...(system ? { system } : {}),
        messages,
        ...(tools ? { tools, stopWhen: stepCountIs(8) } : {}),
      })

      for await (const chunk of result.fullStream) {
        if (chunk.type === 'text-delta') {
          yield {
            type: 'text-delta',
            agentId: session.agentId,
            timestamp: Date.now(),
            payload: { delta: chunk.text },
          }
        } else if (chunk.type === 'tool-call') {
          yield {
            type: 'tool-call',
            agentId: session.agentId,
            timestamp: Date.now(),
            payload: {
              toolCallId: chunk.toolCallId,
              toolName: chunk.toolName,
              input: chunk.input,
            },
          }
        } else if (chunk.type === 'tool-result') {
          yield {
            type: 'tool-result',
            agentId: session.agentId,
            timestamp: Date.now(),
            payload: {
              toolCallId: chunk.toolCallId,
              toolName: chunk.toolName,
              output: chunk.output,
            },
          }
        } else if (chunk.type === 'tool-error') {
          yield {
            type: 'tool-result',
            agentId: session.agentId,
            timestamp: Date.now(),
            payload: {
              toolCallId: chunk.toolCallId,
              toolName: chunk.toolName,
              error: stringifyError(chunk.error),
              isError: true,
            },
          }
        } else if (chunk.type === 'error') {
          // The AI SDK surfaces stream failures (bad/missing key, wrong model,
          // network) as an `error` part rather than throwing — make it visible.
          yield {
            type: 'error',
            agentId: session.agentId,
            timestamp: Date.now(),
            payload: { message: stringifyError(chunk.error) },
          }
          yield {
            type: 'status-change',
            agentId: session.agentId,
            timestamp: Date.now(),
            payload: { status: 'error' },
          }
          return
        }
      }

      yield {
        type: 'status-change',
        agentId: session.agentId,
        timestamp: Date.now(),
        payload: { status: 'idle' },
      }
    } catch (err) {
      // Anything thrown before/around the stream (model resolution, missing key)
      // also surfaces as a visible error instead of a silent failure.
      yield {
        type: 'error',
        agentId: session.agentId,
        timestamp: Date.now(),
        payload: { message: stringifyError(err) },
      }
      yield {
        type: 'status-change',
        agentId: session.agentId,
        timestamp: Date.now(),
        payload: { status: 'error' },
      }
    }
  }

  async stop(sessionId: string): Promise<void> {
    abortSessionApprovals(sessionId)
  }

  async approve(requestId: string): Promise<void> {
    resolveApproval(requestId, true)
  }

  async deny(requestId: string): Promise<void> {
    resolveApproval(requestId, false)
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
