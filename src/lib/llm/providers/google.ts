// src/lib/llm/providers/google.ts
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import type { LanguageModel } from 'ai'
import type { LLMProvider, BaseModel, Credentials, ConnectionResult } from '@/lib/interfaces'

export interface GoogleModel extends BaseModel {
  provider: 'google'
}

/**
 * Google Gemini provider, backed by `@ai-sdk/google`.
 *
 * {@link listModels} returns a curated, static list of Gemini models rather than
 * querying an endpoint, so {@link testConnection} only validates that the list
 * resolves — it does not make a network round-trip.
 */
export class GoogleProvider implements LLMProvider<GoogleModel> {
  readonly providerId = 'google'
  readonly displayName = 'Google Gemini'
  readonly authType = 'api-key' as const

  async listModels(_credentials: Credentials): Promise<GoogleModel[]> {
    return [
      { id: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', contextWindow: 1048576, supportsTools: true, supportsStreaming: true, provider: 'google' },
      { id: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', contextWindow: 1048576, supportsTools: true, supportsStreaming: true, provider: 'google' },
      { id: 'gemini-2.0-flash', displayName: 'Gemini 2.0 Flash', contextWindow: 1048576, supportsTools: true, supportsStreaming: true, provider: 'google' },
    ]
  }

  createAdapter(model: GoogleModel, credentials: Credentials): LanguageModel {
    const google = createGoogleGenerativeAI({ apiKey: credentials.apiKey })
    return google(model.id) as LanguageModel
  }

  async testConnection(credentials: Credentials): Promise<ConnectionResult> {
    const start = Date.now()
    try {
      await this.listModels(credentials)
      return { success: true, latencyMs: Date.now() - start }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  }
}
