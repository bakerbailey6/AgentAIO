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
import { GoogleProvider } from './google'
import { OpenAIProvider } from './openai'
import { OllamaProvider } from './ollama'
import { ClaudeCliProvider } from './claude-cli'
import { CodexCliProvider } from './codex-cli'

/** Built-in providers, ready to use out of the box. */
export const PROVIDER_REGISTRY = new Map<string, LLMProvider>([
  ['anthropic', new AnthropicProvider()],
  ['google', new GoogleProvider()],
  ['openai', new OpenAIProvider()],
  ['ollama', new OllamaProvider()],
  ['claude-cli', new ClaudeCliProvider()],
  ['codex-cli', new CodexCliProvider()],
])

/** Register (or replace) a provider under its `providerId`. */
export function registerProvider(provider: LLMProvider): void {
  PROVIDER_REGISTRY.set(provider.providerId, provider)
}
