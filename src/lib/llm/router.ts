/**
 * Resolves a stored model id into a ready-to-call AI SDK adapter.
 *
 * This is the single point where a persisted `models` row, its registered
 * {@link LLMProvider}, and its keychain-held API key are brought together. Agent
 * runtimes ask the router for an adapter and stay ignorant of which provider
 * backs it — switching the model behind an agent is just a different `modelId`.
 *
 * @module
 */
import type { LanguageModel } from 'ai'
import { initDb } from '@/lib/storage'
import { ModelRepository } from '@/lib/storage/repositories/models'
import { getSecret } from '@/lib/keychain'
import { PROVIDER_REGISTRY } from './providers'

export class LLMRouter {
  /**
   * Look up `modelId` in storage and return an AI SDK adapter for it.
   *
   * Loads the model row, finds its provider in {@link PROVIDER_REGISTRY}, pulls
   * the API key from the OS keychain (if the model references one), and asks the
   * provider to build the adapter.
   *
   * @throws If the model id is unknown or its provider is not registered.
   */
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
