import type { LanguageModel } from 'ai'

export interface BaseModel {
  id: string
  displayName: string
  contextWindow: number
  supportsTools: boolean
  supportsStreaming: boolean
}

export interface Credentials {
  apiKey?: string
  baseUrl?: string
}

export interface ConnectionResult {
  success: boolean
  error?: string
  latencyMs?: number
}

export interface LLMProvider<TModel extends BaseModel = BaseModel> {
  readonly providerId: string
  readonly displayName: string
  listModels(credentials: Credentials): Promise<TModel[]>
  createAdapter(model: TModel, credentials: Credentials): LanguageModel
  testConnection(credentials: Credentials): Promise<ConnectionResult>
}
