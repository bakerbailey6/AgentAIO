import { describe, it, expect } from 'vitest'
import { AnthropicProvider } from '../anthropic'
import { OpenAIProvider } from '../openai'
import { OllamaProvider } from '../ollama'

describe('provider authType', () => {
  it('marks API-key providers as api-key', () => {
    expect(new AnthropicProvider().authType).toBe('api-key')
    expect(new OpenAIProvider().authType).toBe('api-key')
  })

  it('marks Ollama as needing no auth', () => {
    expect(new OllamaProvider().authType).toBe('none')
  })
})
