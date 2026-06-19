import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { GoogleProvider } from '../google'

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn(() => vi.fn((id: string) => ({ modelId: id }))),
}))

describe('GoogleProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('has the google provider identity', () => {
    const provider = new GoogleProvider()
    expect(provider.providerId).toBe('google')
    expect(provider.displayName).toBe('Google Gemini')
  })

  describe('listModels', () => {
    it('returns the static Gemini model list with the correct shape', async () => {
      const provider = new GoogleProvider()
      const models = await provider.listModels({})

      expect(models).toHaveLength(3)
      for (const model of models) {
        expect(model).toMatchObject({
          id: expect.any(String),
          displayName: expect.any(String),
          contextWindow: expect.any(Number),
          supportsTools: expect.any(Boolean),
          supportsStreaming: expect.any(Boolean),
          provider: 'google',
        })
      }
      expect(models.map((m) => m.id)).toEqual([
        'gemini-2.5-pro',
        'gemini-2.5-flash',
        'gemini-2.0-flash',
      ])
    })
  })

  describe('createAdapter', () => {
    it('builds the AI SDK adapter with the supplied apiKey and model id', async () => {
      const provider = new GoogleProvider()
      const model = (await provider.listModels({}))[0]

      const adapter = provider.createAdapter(model, { apiKey: 'gk-test' })

      expect(createGoogleGenerativeAI).toHaveBeenCalledWith({ apiKey: 'gk-test' })
      expect(adapter).toBeTruthy()
    })
  })

  describe('testConnection', () => {
    it('reports success with a non-negative numeric latency', async () => {
      const provider = new GoogleProvider()
      const result = await provider.testConnection({ apiKey: 'gk-test' })

      expect(result.success).toBe(true)
      expect(typeof result.latencyMs).toBe('number')
      expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    })

    it('reports failure when listModels throws', async () => {
      const provider = new GoogleProvider()
      vi.spyOn(provider, 'listModels').mockRejectedValueOnce(new Error('boom'))

      const result = await provider.testConnection({ apiKey: 'gk-test' })

      expect(result.success).toBe(false)
      expect(result.error).toContain('boom')
    })
  })
})
