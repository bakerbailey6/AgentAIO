import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { OllamaProvider } from '../ollama'

vi.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: vi.fn(() => vi.fn((id: string) => ({ modelId: id }))),
}))

describe('OllamaProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('has the ollama provider identity', () => {
    const provider = new OllamaProvider()
    expect(provider.providerId).toBe('ollama')
    expect(provider.displayName).toBe('Ollama (Local)')
  })

  describe('listModels', () => {
    it('maps the /api/tags response into Ollama models', async () => {
      const fetchMock = vi.fn(async () => ({
        ok: true,
        json: async () => ({ models: [{ name: 'llama3' }, { name: 'qwen2.5' }] }),
      }))
      vi.stubGlobal('fetch', fetchMock)

      const provider = new OllamaProvider()
      const models = await provider.listModels({})

      expect(fetchMock).toHaveBeenCalledWith('http://localhost:11434/api/tags')
      expect(models).toEqual([
        { id: 'llama3', displayName: 'llama3', contextWindow: 8192, supportsTools: false, supportsStreaming: true, provider: 'ollama' },
        { id: 'qwen2.5', displayName: 'qwen2.5', contextWindow: 8192, supportsTools: false, supportsStreaming: true, provider: 'ollama' },
      ])
    })

    it('uses a custom baseUrl when provided', async () => {
      const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ models: [] }) }))
      vi.stubGlobal('fetch', fetchMock)

      const provider = new OllamaProvider()
      await provider.listModels({ baseUrl: 'http://remote:11434' })

      expect(fetchMock).toHaveBeenCalledWith('http://remote:11434/api/tags')
    })

    // Previously listModels swallowed fetch failures and returned [], making an
    // unreachable server indistinguishable from a running server with zero
    // models. It now propagates the failure so callers can surface it.
    it('throws (does not return []) when the server is unreachable', async () => {
      const fetchMock = vi.fn(async () => {
        throw new Error('ECONNREFUSED')
      })
      vi.stubGlobal('fetch', fetchMock)

      const provider = new OllamaProvider()
      await expect(provider.listModels({})).rejects.toThrow(/ECONNREFUSED|reach Ollama/)
    })

    it('throws when the server responds with a non-OK HTTP status', async () => {
      const fetchMock = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }))
      vi.stubGlobal('fetch', fetchMock)

      const provider = new OllamaProvider()
      await expect(provider.listModels({})).rejects.toThrow(/500/)
    })
  })

  describe('createAdapter', () => {
    it('builds an OpenAI-compatible adapter pointed at the default /v1 endpoint', () => {
      const provider = new OllamaProvider()
      const model = { id: 'llama3', displayName: 'llama3', contextWindow: 8192, supportsTools: false, supportsStreaming: true, provider: 'ollama' as const }

      const adapter = provider.createAdapter(model, {})

      expect(createOpenAICompatible).toHaveBeenCalledWith({
        name: 'ollama',
        baseURL: 'http://localhost:11434/v1',
      })
      expect(adapter).toBeTruthy()
    })

    it('respects a custom baseUrl for the /v1 endpoint', () => {
      const provider = new OllamaProvider()
      const model = { id: 'llama3', displayName: 'llama3', contextWindow: 8192, supportsTools: false, supportsStreaming: true, provider: 'ollama' as const }

      provider.createAdapter(model, { baseUrl: 'http://remote:11434' })

      expect(createOpenAICompatible).toHaveBeenCalledWith({
        name: 'ollama',
        baseURL: 'http://remote:11434/v1',
      })
    })
  })

  describe('testConnection', () => {
    it('reports success with a non-negative numeric latency when the server responds', async () => {
      const fetchMock = vi.fn(async () => ({ json: async () => ({ models: [] }) }))
      vi.stubGlobal('fetch', fetchMock)

      const provider = new OllamaProvider()
      const result = await provider.testConnection({})

      expect(fetchMock).toHaveBeenCalledWith('http://localhost:11434/api/tags')
      expect(result.success).toBe(true)
      expect(typeof result.latencyMs).toBe('number')
      expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    })

    it('reports failure with an error when fetch rejects', async () => {
      const fetchMock = vi.fn(async () => {
        throw new Error('ECONNREFUSED')
      })
      vi.stubGlobal('fetch', fetchMock)

      const provider = new OllamaProvider()
      const result = await provider.testConnection({})

      expect(result.success).toBe(false)
      expect(result.error).toContain('ECONNREFUSED')
    })
  })
})
