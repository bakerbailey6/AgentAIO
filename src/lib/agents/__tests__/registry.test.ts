import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { AgentProvider, AgentCapabilities } from '@/lib/interfaces'

// The registry instantiates the LLM agent (which transitively imports the router,
// storage, and the AI SDK) and the coding agents (which import the Tauri bridge).
// Mock those boundaries so importing the registry never touches a real backend.
vi.mock('@/lib/storage', () => ({ initDb: vi.fn(async () => ({})), AgentRepository: vi.fn() }))
vi.mock('@/lib/llm/router', () => ({ LLMRouter: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => null) }))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => {}) }))

import { AGENT_REGISTRY, registerAgent } from '@/lib/agents/registry'

describe('AGENT_REGISTRY', () => {
  it('contains the three built-in agent types', () => {
    expect([...AGENT_REGISTRY.keys()].sort()).toEqual(['claude-code', 'codex', 'llm'])
  })

  it('maps each key to a provider whose .type matches the key', () => {
    for (const [key, provider] of AGENT_REGISTRY) {
      expect(provider.type).toBe(key)
    }
  })

  it('exposes the expected capabilities per provider', () => {
    const caps = (type: string): AgentCapabilities => AGENT_REGISTRY.get(type)!.getCapabilities()

    expect(caps('llm')).toEqual({
      supportsTools: true,
      supportsStreaming: true,
      supportsApprovalGates: true,
      requiresProjectDirectory: false,
    })
    expect(caps('claude-code')).toEqual({
      supportsTools: true,
      supportsStreaming: true,
      supportsApprovalGates: true,
      requiresProjectDirectory: true,
    })
    expect(caps('codex')).toEqual({
      supportsTools: true,
      supportsStreaming: true,
      supportsApprovalGates: true,
      requiresProjectDirectory: true,
    })
  })
})

describe('registerAgent', () => {
  function makeProvider(type: string): AgentProvider {
    return {
      type,
      displayName: type,
      icon: '🧪',
      configure: vi.fn(async () => {}),
      run: vi.fn(async function* () {}),
      stop: vi.fn(async () => {}),
      approve: vi.fn(async () => {}),
      deny: vi.fn(async () => {}),
      getCapabilities: vi.fn(() => ({
        supportsTools: false,
        supportsStreaming: false,
        supportsApprovalGates: false,
        requiresProjectDirectory: false,
      })),
    }
  }

  // Use a throwaway type so we never clobber the shared built-in entries.
  beforeEach(() => {
    AGENT_REGISTRY.delete('custom-test')
  })

  it('adds a provider keyed by its type', () => {
    const provider = makeProvider('custom-test')
    registerAgent(provider)
    expect(AGENT_REGISTRY.get('custom-test')).toBe(provider)
  })

  it('overwrites an existing entry with the same type', () => {
    const first = makeProvider('custom-test')
    const second = makeProvider('custom-test')
    registerAgent(first)
    registerAgent(second)
    expect(AGENT_REGISTRY.get('custom-test')).toBe(second)
  })
})
