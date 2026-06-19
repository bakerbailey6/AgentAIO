/**
 * Registry of available {@link AgentProvider} runtimes, keyed by `type`. The
 * canvas resolves an agent's `type` to a provider here when running it. To add a
 * runtime, implement `AgentProvider` and {@link registerAgent} it.
 *
 * @module
 */
import type { AgentProvider } from '@/lib/interfaces'
import { LLMAgentProvider } from './llm-agent'
import { ClaudeCodeAgentProvider } from './claude-code-agent'
import { CodexAgentProvider } from './codex-agent'

/** Built-in agent runtimes available out of the box. */
export const AGENT_REGISTRY = new Map<string, AgentProvider>([
  ['llm', new LLMAgentProvider()],
  ['claude-code', new ClaudeCodeAgentProvider()],
  ['codex', new CodexAgentProvider()],
])

/** Register (or replace) an agent runtime under its `type`. */
export function registerAgent(provider: AgentProvider): void {
  AGENT_REGISTRY.set(provider.type, provider)
}

/**
 * Map a persisted agent `type` to its runtime key in {@link AGENT_REGISTRY}.
 *
 * The `agents` table's CHECK constraint stores `'coding-agent'` / `'custom'`
 * (the values `CreateAgentPanel` writes), but the coding-agent runtimes are
 * registered under `'claude-code'` / `'codex'`. Without this mapping
 * `AGENT_REGISTRY.get(agent.type)` returns `undefined` and coding agents never
 * run. Unknown/already-correct values pass through unchanged.
 */
export function resolveAgentRuntimeType(storedType: string): string {
  switch (storedType) {
    case 'coding-agent':
      return 'claude-code'
    case 'custom':
      return 'codex'
    default:
      return storedType
  }
}
