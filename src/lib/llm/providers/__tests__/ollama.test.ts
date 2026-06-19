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
      const fetchMock = vi.fn(async () => ({ json: async () => ({ models: [] }) }))
      vi.stubGlobal('fetch', fetchMock)

      const provider = new OllamaProvider()
      await provider.listModels({ baseUrl: 'http://remote:11434' })

      expect(fetchMock).toHaveBeenCalledWith('http://remote:11434/api/tags')
    })

    // FINDING: listModels swallows fetch failures and returns [] instead of
    // throwing, so an unreachable server is indistinguishable from a running
    // server with zero models. Documented here; reported in the WP2 summary.
    it('returns an empty array (does not throw) when the server is unreachable', async () => {
      const fetchMock = vi.fn(async () => {
        throw new Error('ECONNREFUSED')
      })
      vi.stubGlobal('fetch', fetchMock)

      const provider = new OllamaProvider()
      await expect(provider.listModels({})).resolves.toEqual([])
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
