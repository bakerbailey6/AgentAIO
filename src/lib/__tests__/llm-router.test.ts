import { describe, it, expect, vi } from 'vitest'

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn(() => (modelId: string) => ({ modelId, provider: 'anthropic' })),
}))
vi.mock('@/lib/keychain', () => ({
  getSecret: vi.fn(async () => 'test-api-key'),
}))
vi.mock('@/lib/storage', () => ({
  initDb: vi.fn(async () => ({
    select: vi.fn(async () => [{
      id: 'model-1', provider: 'anthropic', model_name: 'claude-sonnet-4-6',
      display_name: 'Claude Sonnet 4.6', api_key_ref: 'anthropic-key', base_url: null,
    }]),
  })),
}))

import { LLMRouter } from '@/lib/llm/router'

describe('LLMRouter', () => {
  it('resolves anthropic model to an adapter', async () => {
    const router = new LLMRouter()
    const adapter = await router.getAdapter('model-1')
    expect(adapter).toBeDefined()
  })

  it('throws for unknown model id', async () => {
    const router = new LLMRouter()
    await expect(router.getAdapter('nonexistent')).rejects.toThrow('Model not found')
  })
})
