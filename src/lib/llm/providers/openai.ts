// src/lib/llm/providers/openai.ts
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'
import type { LLMProvider, BaseModel, Credentials, ConnectionResult } from '@/lib/interfaces'

export interface OpenAIModel extends BaseModel {
  provider: 'openai'
}

/**
 * OpenAI provider, backed by `@ai-sdk/openai`.
 *
 * {@link listModels} returns a curated, static list. A `baseUrl` in the
 * credentials is forwarded to the SDK, so this provider also serves any
 * OpenAI-compatible endpoint (Groq, Together, LM Studio, …).
 */
export class OpenAIProvider implements LLMProvider<OpenAIModel> {
  readonly providerId = 'openai'
  readonly displayName = 'OpenAI'

  async listModels(_credentials: Credentials): Promise<OpenAIModel[]> {
    return [
      { id: 'gpt-4o', displayName: 'GPT-4o', contextWindow: 128000, supportsTools: true, supportsStreaming: true, provider: 'openai' },
      { id: 'gpt-4o-mini', displayName: 'GPT-4o Mini', contextWindow: 128000, supportsTools: true, supportsStreaming: true, provider: 'openai' },
      { id: 'o3', displayName: 'o3', contextWindow: 200000, supportsTools: true, supportsStreaming: false, provider: 'openai' },
    ]
  }

  createAdapter(model: OpenAIModel, credentials: Credentials): LanguageModel {
    const openai = createOpenAI({
      apiKey: credentials.apiKey,
      ...(credentials.baseUrl ? { baseURL: credentials.baseUrl } : {}),
    })
    return openai(model.id) as LanguageModel
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
