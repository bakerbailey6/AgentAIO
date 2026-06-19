import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createOpenAI } from '@ai-sdk/openai'
import { OpenAIProvider } from '../openai'

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => vi.fn((id: string) => ({ modelId: id }))),
}))

describe('OpenAIProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('has the openai provider identity', () => {
    const provider = new OpenAIProvider()
    expect(provider.providerId).toBe('openai')
    expect(provider.displayName).toBe('OpenAI')
  })

  describe('listModels', () => {
    it('returns the static OpenAI model list with the correct shape', async () => {
      const provider = new OpenAIProvider()
      const models = await provider.listModels({})

      expect(models).toHaveLength(3)
      for (const model of models) {
        expect(model).toMatchObject({
          id: expect.any(String),
          displayName: expect.any(String),
          contextWindow: expect.any(Number),
          supportsTools: expect.any(Boolean),
          supportsStreaming: expect.any(Boolean),
          provider: 'openai',
        })
      }
      expect(models.map((m) => m.id)).toEqual(['gpt-4o', 'gpt-4o-mini', 'o3'])
    })

    it('preserves per-model streaming support (o3 does not stream)', async () => {
      const provider = new OpenAIProvider()
      const models = await provider.listModels({})
      const o3 = models.find((m) => m.id === 'o3')
      expect(o3?.supportsStreaming).toBe(false)
    })
  })

  describe('createAdapter', () => {
    it('builds the adapter with only apiKey when no baseUrl is given', async () => {
      const provider = new OpenAIProvider()
      const model = (await provider.listModels({}))[0]

      const adapter = provider.createAdapter(model, { apiKey: 'sk-test' })

      expect(createOpenAI).toHaveBeenCalledWith({ apiKey: 'sk-test' })
      expect(adapter).toBeTruthy()
    })

    it('passes baseURL through when a baseUrl credential is given', async () => {
      const provider = new OpenAIProvider()
      const model = (await provider.listModels({}))[0]

      provider.createAdapter(model, { apiKey: 'sk-test', baseUrl: 'https://proxy.example/v1' })

      expect(createOpenAI).toHaveBeenCalledWith({
        apiKey: 'sk-test',
        baseURL: 'https://proxy.example/v1',
      })
    })
  })

  describe('testConnection', () => {
    it('reports success with a non-negative numeric latency', async () => {
      const provider = new OpenAIProvider()
      const result = await provider.testConnection({ apiKey: 'sk-test' })

      expect(result.success).toBe(true)
      expect(typeof result.latencyMs).toBe('number')
      expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    })

    it('reports failure when listModels throws', async () => {
      const provider = new OpenAIProvider()
      vi.spyOn(provider, 'listModels').mockRejectedValueOnce(new Error('boom'))

      const result = await provider.testConnection({ apiKey: 'sk-test' })

      expect(result.success).toBe(false)
      expect(result.error).toContain('boom')
    })
  })
})
