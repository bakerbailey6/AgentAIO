import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/llm/router', () => ({
  LLMRouter: vi.fn().mockImplementation(() => ({
    getAdapter: vi.fn(async () => ({
      doStream: vi.fn(async function* () {
        yield { type: 'text-delta', textDelta: 'Hello' }
        yield { type: 'finish', finishReason: 'stop', usage: { promptTokens: 10, completionTokens: 5 } }
      }),
    })),
  })),
}))
vi.mock('@/lib/storage', () => ({ initDb: vi.fn(async () => ({})) }))

import { LLMAgentProvider } from '@/lib/agents/llm-agent'

describe('LLMAgentProvider', () => {
  it('implements AgentProvider interface', () => {
    const provider = new LLMAgentProvider()
    expect(provider.type).toBe('llm')
    expect(typeof provider.run).toBe('function')
    expect(typeof provider.stop).toBe('function')
    expect(typeof provider.approve).toBe('function')
    expect(typeof provider.deny).toBe('function')
    expect(typeof provider.getCapabilities).toBe('function')
  })

  it('getCapabilities returns expected values', () => {
    const provider = new LLMAgentProvider()
    const caps = provider.getCapabilities()
    expect(caps.supportsTools).toBe(true)
    expect(caps.supportsStreaming).toBe(true)
    expect(caps.requiresProjectDirectory).toBe(false)
  })
})
