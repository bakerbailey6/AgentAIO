/**
 * Registry of available {@link LLMProvider} implementations, keyed by
 * `providerId`. The {@link LLMRouter} looks providers up here when resolving a
 * model. To add a vendor, implement `LLMProvider` and {@link registerProvider}
 * it — nothing else needs to change.
 *
 * @module
 */
import type { LLMProvider } from '@/lib/interfaces'
import { AnthropicProvider } from './anthropic'
import { OpenAIProvider } from './openai'
import { OllamaProvider } from './ollama'

/** Built-in providers, ready to use out of the box. */
export const PROVIDER_REGISTRY = new Map<string, LLMProvider>([
  ['anthropic', new AnthropicProvider()],
  ['openai', new OpenAIProvider()],
  ['ollama', new OllamaProvider()],
])

/** Register (or replace) a provider under its `providerId`. */
export function registerProvider(provider: LLMProvider): void {
  PROVIDER_REGISTRY.set(provider.providerId, provider)
}
