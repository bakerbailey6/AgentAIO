import { describe, it, expect, vi } from 'vitest'

// A CLI-backed model carries no api_key_ref, so the router must never reach for
// the keychain when resolving it.
const { getSecretSpy } = vi.hoisted(() => ({ getSecretSpy: vi.fn(async () => 'SHOULD-NOT-BE-USED') }))
vi.mock('@/lib/keychain', () => ({ getSecret: getSecretSpy }))
vi.mock('@/lib/storage', () => ({
  initDb: vi.fn(async () => ({
    select: vi.fn(async (_sql: string, params?: unknown[]) => {
      const id = Array.isArray(params) ? params[0] : undefined
      if (id !== 'cli-model-1') return []
      return [{
        id: 'cli-model-1', provider: 'claude-cli', model_name: 'opus',
        display_name: 'Claude Opus (subscription)', api_key_ref: null, base_url: null,
      }]
    }),
  })),
}))

import { LLMRouter } from '@/lib/llm/router'

describe('LLMRouter with a CLI provider', () => {
  it('resolves a claude-cli model to a v2 adapter without touching the keychain', async () => {
    const router = new LLMRouter()
    const adapter = await router.getAdapter('cli-model-1')
    expect((adapter as unknown as { specificationVersion: string }).specificationVersion).toBe('v2')
    expect(getSecretSpy).not.toHaveBeenCalled()
  })
})
