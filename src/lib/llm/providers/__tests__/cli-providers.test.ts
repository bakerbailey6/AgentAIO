import { describe, it, expect } from 'vitest'
import { ClaudeCliProvider } from '../claude-cli'
import { CodexCliProvider } from '../codex-cli'
import { PROVIDER_REGISTRY } from '../index'

describe('CLI subscription providers', () => {
  it('expose a cli authType and stable ids', () => {
    expect(new ClaudeCliProvider().authType).toBe('cli')
    expect(new ClaudeCliProvider().providerId).toBe('claude-cli')
    expect(new CodexCliProvider().authType).toBe('cli')
    expect(new CodexCliProvider().providerId).toBe('codex-cli')
  })

  it('are registered in PROVIDER_REGISTRY', () => {
    expect(PROVIDER_REGISTRY.get('claude-cli')).toBeInstanceOf(ClaudeCliProvider)
    expect(PROVIDER_REGISTRY.get('codex-cli')).toBeInstanceOf(CodexCliProvider)
  })

  it('list curated models and build a v2 adapter', async () => {
    const provider = new ClaudeCliProvider()
    const models = await provider.listModels({})
    expect(models.length).toBeGreaterThan(0)
    const adapter = provider.createAdapter(models[0], {})
    expect((adapter as unknown as { specificationVersion: string }).specificationVersion).toBe('v2')
  })

  it('testConnection succeeds without any credentials', async () => {
    const result = await new CodexCliProvider().testConnection({})
    expect(result.success).toBe(true)
  })
})
