// src/lib/llm/providers/anthropic.ts
import { createAnthropic } from '@ai-sdk/anthropic'
import type { LanguageModel } from 'ai'
import type { LLMProvider, BaseModel, Credentials, ConnectionResult } from '@/lib/interfaces'

export interface AnthropicModel extends BaseModel {
  provider: 'anthropic'
}

export class AnthropicProvider implements LLMProvider<AnthropicModel> {
  readonly providerId = 'anthropic'
  readonly displayName = 'Anthropic'

  async listModels(_credentials: Credentials): Promise<AnthropicModel[]> {
    return [
      { id: 'claude-opus-4-8', displayName: 'Claude Opus 4.8', contextWindow: 200000, supportsTools: true, supportsStreaming: true, provider: 'anthropic' },
      { id: 'claude-sonnet-4-6', displayName: 'Claude Sonnet 4.6', contextWindow: 200000, supportsTools: true, supportsStreaming: true, provider: 'anthropic' },
      { id: 'claude-haiku-4-5-20251001', displayName: 'Claude Haiku 4.5', contextWindow: 200000, supportsTools: true, supportsStreaming: true, provider: 'anthropic' },
    ]
  }

  createAdapter(model: AnthropicModel, credentials: Credentials): LanguageModel {
    const anthropic = createAnthropic({ apiKey: credentials.apiKey })
    return anthropic(model.id) as LanguageModel
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
