// src/lib/llm/providers/ollama.ts
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModel } from 'ai'
import type { LLMProvider, BaseModel, Credentials, ConnectionResult } from '@/lib/interfaces'

export interface OllamaModel extends BaseModel {
  provider: 'ollama'
}

export class OllamaProvider implements LLMProvider<OllamaModel> {
  readonly providerId = 'ollama'
  readonly displayName = 'Ollama (Local)'

  async listModels(credentials: Credentials): Promise<OllamaModel[]> {
    const baseUrl = credentials.baseUrl ?? 'http://localhost:11434'
    let res: Response
    try {
      res = await fetch(`${baseUrl}/api/tags`)
    } catch (e) {
      // Propagate connection failures instead of swallowing them — an
      // unreachable server must be distinguishable from "zero models".
      throw new Error(`Cannot reach Ollama at ${baseUrl}: ${String(e)}`)
    }
    if (!res.ok) {
      throw new Error(`Ollama at ${baseUrl} returned HTTP ${res.status}`)
    }
    const data = await res.json() as { models: Array<{ name: string }> }
    return data.models.map((m) => ({
      id: m.name,
      displayName: m.name,
      contextWindow: 8192,
      supportsTools: false,
      supportsStreaming: true,
      provider: 'ollama' as const,
    }))
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
