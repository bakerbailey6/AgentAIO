import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAnthropic } from '@ai-sdk/anthropic'
import { AnthropicProvider } from '../anthropic'

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn(() => vi.fn((id: string) => ({ modelId: id }))),
}))

describe('AnthropicProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('has the anthropic provider identity', () => {
    const provider = new AnthropicProvider()
    expect(provider.providerId).toBe('anthropic')
    expect(provider.displayName).toBe('Anthropic')
  })

  describe('listModels', () => {
    it('returns the static Anthropic model list with the correct shape', async () => {
      const provider = new AnthropicProvider()
      const models = await provider.listModels({})

      expect(models).toHaveLength(3)
      for (const model of models) {
        expect(model).toMatchObject({
          id: expect.any(String),
          displayName: expect.any(String),
          contextWindow: expect.any(Number),
          supportsTools: expect.any(Boolean),
          supportsStreaming: expect.any(Boolean),
          provider: 'anthropic',
        })
      }
      expect(models.map((m) => m.id)).toEqual([
        'claude-opus-4-8',
        'claude-sonnet-4-6',
        'claude-haiku-4-5-20251001',
      ])
    })
  })

  describe('createAdapter', () => {
    it('builds the AI SDK adapter with the supplied apiKey and model id', async () => {
      const provider = new AnthropicProvider()
      const model = (await provider.listModels({}))[0]

      const adapter = provider.createAdapter(model, { apiKey: 'sk-test' })

      expect(createAnthropic).toHaveBeenCalledWith({ apiKey: 'sk-test' })
      expect(adapter).toBeTruthy()
    })
  })

  describe('testConnection', () => {
    it('reports success with a non-negative numeric latency', async () => {
      const provider = new AnthropicProvider()
      const result = await provider.testConnection({ apiKey: 'sk-test' })

      expect(result.success).toBe(true)
      expect(typeof result.latencyMs).toBe('number')
      expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    })

    it('reports failure when listModels throws', async () => {
      const provider = new AnthropicProvider()
      vi.spyOn(provider, 'listModels').mockRejectedValueOnce(new Error('boom'))

      const result = await provider.testConnection({ apiKey: 'sk-test' })

      expect(result.success).toBe(false)
      expect(result.error).toContain('boom')
    })
  })
})
