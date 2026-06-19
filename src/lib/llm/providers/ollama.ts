// src/lib/llm/providers/ollama.ts
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModel } from 'ai'
import type { LLMProvider, BaseModel, Credentials, ConnectionResult } from '@/lib/interfaces'

export interface OllamaModel extends BaseModel {
  provider: 'ollama'
}

/**
 * Local Ollama provider, backed by `@ai-sdk/openai-compatible`.
 *
 * Unlike the cloud providers, {@link listModels} actually queries the running
 * Ollama server (`/api/tags`) so the model picker reflects what is installed
 * locally; it returns `[]` if the server is unreachable. Defaults to
 * `http://localhost:11434` when no `baseUrl` is given, and needs no API key.
 */
export class OllamaProvider implements LLMProvider<OllamaModel> {
  readonly providerId = 'ollama'
  readonly displayName = 'Ollama (Local)'

  async listModels(credentials: Credentials): Promise<OllamaModel[]> {
    const baseUrl = credentials.baseUrl ?? 'http://localhost:11434'
    try {
      const res = await fetch(`${baseUrl}/api/tags`)
      const data = await res.json() as { models: Array<{ name: string }> }
      return data.models.map((m) => ({
        id: m.name,
        displayName: m.name,
        contextWindow: 8192,
        supportsTools: false,
        supportsStreaming: true,
        provider: 'ollama' as const,
      }))
    } catch {
      return []
    }
  }

  createAdapter(model: OllamaModel, credentials: Credentials): LanguageModel {
    const baseUrl = credentials.baseUrl ?? 'http://localhost:11434'
    const ollama = createOpenAICompatible({
      name: 'ollama',
      baseURL: `${baseUrl}/v1`,
    })
    return ollama(model.id) as LanguageModel
  }

  async testConnection(credentials: Credentials): Promise<ConnectionResult> {
    const start = Date.now()
    try {
      const baseUrl = credentials.baseUrl ?? 'http://localhost:11434'
      await fetch(`${baseUrl}/api/tags`)
      return { success: true, latencyMs: Date.now() - start }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  }
}
