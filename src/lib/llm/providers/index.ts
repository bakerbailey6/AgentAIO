// src/lib/llm/providers/index.ts
import type { LLMProvider } from '@/lib/interfaces'
import { AnthropicProvider } from './anthropic'
import { OpenAIProvider } from './openai'
import { OllamaProvider } from './ollama'

export const PROVIDER_REGISTRY = new Map<string, LLMProvider>([
  ['anthropic', new AnthropicProvider()],
  ['openai', new OpenAIProvider()],
  ['ollama', new OllamaProvider()],
])

export function registerProvider(provider: LLMProvider): void {
  PROVIDER_REGISTRY.set(provider.providerId, provider)
}
