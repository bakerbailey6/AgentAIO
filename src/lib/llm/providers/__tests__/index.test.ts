import { describe, it, expect } from 'vitest'
import { PROVIDER_REGISTRY, registerProvider } from '../index'
import { AnthropicProvider } from '../anthropic'
import { GoogleProvider } from '../google'
import { OpenAIProvider } from '../openai'
import { OllamaProvider } from '../ollama'
import type { LLMProvider } from '@/lib/interfaces'

describe('PROVIDER_REGISTRY', () => {
  it('is a Map keyed by providerId', () => {
    expect(PROVIDER_REGISTRY).toBeInstanceOf(Map)
    expect([...PROVIDER_REGISTRY.keys()].sort()).toEqual([
      'anthropic',
      'claude-cli',
      'codex-cli',
      'google',
      'ollama',
      'openai',
    ])
  })

  it('maps each key to the matching provider instance with the correct providerId', () => {
    expect(PROVIDER_REGISTRY.get('anthropic')).toBeInstanceOf(AnthropicProvider)
    expect(PROVIDER_REGISTRY.get('google')).toBeInstanceOf(GoogleProvider)
    expect(PROVIDER_REGISTRY.get('openai')).toBeInstanceOf(OpenAIProvider)
    expect(PROVIDER_REGISTRY.get('ollama')).toBeInstanceOf(OllamaProvider)

    for (const [key, provider] of PROVIDER_REGISTRY) {
      expect(provider.providerId).toBe(key)
    }
  })
})

describe('registerProvider', () => {
  it('adds a new provider keyed by its providerId', () => {
    const custom: LLMProvider = {
      providerId: 'custom-test',
      displayName: 'Custom Test',
      authType: 'api-key',
      listModels: async () => [],
      createAdapter: () => ({}) as never,
      testConnection: async () => ({ success: true }),
    }

    try {
      registerProvider(custom)
      expect(PROVIDER_REGISTRY.get('custom-test')).toBe(custom)
    } finally {
      PROVIDER_REGISTRY.delete('custom-test')
    }
  })

  it('overwrites an existing provider with the same providerId', () => {
    const original = PROVIDER_REGISTRY.get('anthropic')
    const replacement: LLMProvider = {
      providerId: 'anthropic',
      displayName: 'Replacement',
      authType: 'api-key',
      listModels: async () => [],
      createAdapter: () => ({}) as never,
      testConnection: async () => ({ success: true }),
    }

    try {
      registerProvider(replacement)
      expect(PROVIDER_REGISTRY.get('anthropic')).toBe(replacement)
    } finally {
      if (original) PROVIDER_REGISTRY.set('anthropic', original)
    }
  })
})
