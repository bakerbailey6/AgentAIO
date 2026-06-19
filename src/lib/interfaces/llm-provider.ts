/**
 * The LLM provider contract.
 *
 * An {@link LLMProvider} maps one vendor (Anthropic, OpenAI, Ollama, …) onto the
 * Vercel AI SDK's universal {@link LanguageModel}. Implementations live in
 * `src/lib/llm/providers/` and are registered in `PROVIDER_REGISTRY`; the
 * {@link LLMRouter} resolves a stored model to a concrete adapter at call time.
 *
 * @module
 */
import type { LanguageModel } from 'ai'

/** A model offered by a provider, with its capabilities. */
export interface BaseModel {
  /** Provider-native model id, e.g. `'claude-opus-4-8'`. */
  id: string
  displayName: string
  contextWindow: number
  supportsTools: boolean
  supportsStreaming: boolean
}

/**
 * Connection details for a provider.
 *
 * `apiKey` is resolved from the OS keychain at call time and never persisted in
 * the database. `baseUrl` overrides the endpoint for local or OpenAI-compatible
 * servers (Ollama, LM Studio, Groq, …).
 */
export interface Credentials {
  apiKey?: string
  baseUrl?: string
}

/** Outcome of a {@link LLMProvider.testConnection} probe. */
export interface ConnectionResult {
  success: boolean
  error?: string
  latencyMs?: number
}

/**
 * Maps a vendor's models onto the AI SDK's {@link LanguageModel}.
 *
 * @typeParam TModel - The provider's model shape; defaults to {@link BaseModel}.
 */
export interface LLMProvider<TModel extends BaseModel = BaseModel> {
  /** Stable provider id used as the registry key, e.g. `'anthropic'`. */
  readonly providerId: string
  readonly displayName: string
  /** List the models this provider exposes for the given credentials. */
  listModels(credentials: Credentials): Promise<TModel[]>
  /** Build a ready-to-call AI SDK adapter for one model. */
  createAdapter(model: TModel, credentials: Credentials): LanguageModel
  /** Verify the credentials reach the provider, reporting latency. */
  testConnection(credentials: Credentials): Promise<ConnectionResult>
}
