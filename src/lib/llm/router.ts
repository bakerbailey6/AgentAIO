// src/lib/llm/router.ts
import type { LanguageModel } from 'ai'
import { initDb } from '@/lib/storage'
import { ModelRepository } from '@/lib/storage/repositories/models'
import { getSecret } from '@/lib/keychain'
import { PROVIDER_REGISTRY } from './providers'

export class LLMRouter {
  async getAdapter(modelId: string): Promise<LanguageModel> {
    const db = await initDb()
    const repo = new ModelRepository(db)
    const model = await repo.findById(modelId)
    if (!model || model.id !== modelId) throw new Error(`Model not found: ${modelId}`)

    const provider = PROVIDER_REGISTRY.get(model.provider)
    if (!provider) throw new Error(`Provider not registered: ${model.provider}`)

    const apiKey = model.apiKeyRef ? await getSecret(model.apiKeyRef) ?? undefined : undefined
    const credentials = { apiKey, baseUrl: model.baseUrl ?? undefined }

    return provider.createAdapter(
      { id: model.modelName, displayName: model.displayName, contextWindow: 200000, supportsTools: true, supportsStreaming: true },
      credentials,
    )
  }
}
