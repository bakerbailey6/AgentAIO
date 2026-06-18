// src/lib/agents/registry.ts
import type { AgentProvider } from '@/lib/interfaces'
import { LLMAgentProvider } from './llm-agent'
import { ClaudeCodeAgentProvider } from './claude-code-agent'
import { CodexAgentProvider } from './codex-agent'

export const AGENT_REGISTRY = new Map<string, AgentProvider>([
  ['llm', new LLMAgentProvider()],
  ['claude-code', new ClaudeCodeAgentProvider()],
  ['codex', new CodexAgentProvider()],
])

export function registerAgent(provider: AgentProvider): void {
  AGENT_REGISTRY.set(provider.type, provider)
}
