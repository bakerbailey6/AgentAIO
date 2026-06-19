'use client'
import { useState, useEffect } from 'react'
import { PROVIDER_REGISTRY } from '@/lib/llm/providers/index'
import { getSecret } from '@/lib/keychain'
import { initDb } from '@/lib/storage/db'
import { ModelRepository } from '@/lib/storage/repositories/models'
import type { BaseModel } from '@/lib/interfaces'

interface AddModelDialogProps {
  onAdded: () => void
  onCancel: () => void
}

export default function AddModelDialog({ onAdded, onCancel }: AddModelDialogProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedProvider, setSelectedProvider] = useState<string>('')
  const [models, setModels] = useState<BaseModel[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const providerIds = Array.from(PROVIDER_REGISTRY.keys())

  useEffect(() => {
    if (step !== 2 || !selectedProvider) return

    let cancelled = false
    setLoadingModels(true)
    setFetchError(null)

    async function fetchModels() {
      try {
        const provider = PROVIDER_REGISTRY.get(selectedProvider)
        if (!provider) throw new Error('Provider not found')

        const isOllama = selectedProvider === 'ollama'
        const isCli = provider.authType === 'cli'
        const credentials = isOllama
          ? { baseUrl: 'http://localhost:11434' }
          : isCli
            ? {} // CLI subscription providers need no credentials — auth is in the CLI
            : { apiKey: (await getSecret(selectedProvider + '-key')) ?? undefined }

        const result = await provider.listModels(credentials)
        if (!cancelled) setModels(result)
      } catch (e) {
        if (!cancelled) {
          const isOllama = selectedProvider === 'ollama'
          const isCli = PROVIDER_REGISTRY.get(selectedProvider)?.authType === 'cli'
          setFetchError(
            isOllama
              ? 'Ollama not running at localhost:11434'
              : isCli
                ? 'Could not list models — sign in under Providers.'
                : 'Could not fetch models — check your API key in Providers.',
          )
        }
      } finally {
        if (!cancelled) setLoadingModels(false)
      }
    }

    void fetchModels()
    return () => { cancelled = true }
  }, [step, selectedProvider])

  async function handleSelectModel(model: BaseModel) {
    setAdding(true)
    try {
      const db = await initDb()
      const repo = new ModelRepository(db)
      const isOllama = selectedProvider === 'ollama'
      const needsKey = PROVIDER_REGISTRY.get(selectedProvider)?.authType !== 'cli' && !isOllama
      await repo.create({
        provider: selectedProvider,
        modelName: model.id,
        displayName: model.displayName,
        apiKeyRef: needsKey ? selectedProvider + '-key' : null,
        baseUrl: isOllama ? 'http://localhost:11434' : null,
      })
      onAdded()
    } finally {
      setAdding(false)
    }
  }

  const providerDisplayNames: Record<string, string> = {
    anthropic: 'Anthropic',
    google: 'Google Gemini',
    openai: 'OpenAI',
    ollama: 'Ollama (local)',
  }

  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <p className="text-[13px] font-semibold text-zinc-200 flex-1">
          {step === 1 ? 'Select Provider' : 'Select Model'}
        </p>
        {step === 2 && (
          <button
            onClick={() => { setStep(1); setModels([]); setFetchError(null) }}
            className="text-zinc-500 hover:text-zinc-300 text-[11px] transition-colors"
          >
            ← Back
          </button>
        )}
        <button
          onClick={onCancel}
          className="text-zinc-500 hover:text-zinc-300 text-[13px] transition-colors"
        >
          ✕
        </button>
      </div>

      {step === 1 && (
        <div className="flex flex-col gap-2">
          {providerIds.map((id) => (
            <button
              key={id}
              onClick={() => { setSelectedProvider(id); setStep(2) }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-indigo-500/30 transition-all text-left"
            >
              <span className="text-[13px] font-medium text-zinc-200">
                {PROVIDER_REGISTRY.get(id)?.displayName ?? providerDisplayNames[id] ?? id}
              </span>
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-1 min-h-[80px]">
          {loadingModels && (
            <div className="py-4 text-center text-zinc-500 text-[13px]">
              <span className="animate-pulse">Fetching models…</span>
            </div>
          )}

          {fetchError && !loadingModels && (
            <div className="py-4 text-center text-red-400 text-[12px]">{fetchError}</div>
          )}

          {!loadingModels && !fetchError && models.map((model) => (
            <button
              key={model.id}
              onClick={() => handleSelectModel(model)}
              disabled={adding}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.06] border border-transparent hover:border-indigo-500/20 transition-all text-left group disabled:opacity-50"
            >
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-[13px] font-medium text-zinc-200 group-hover:text-indigo-300 transition-colors">
                  {model.displayName}
                </span>
                <span className="text-[11px] text-zinc-500">
                  {model.contextWindow.toLocaleString()} context
                </span>
              </div>
              <span className="text-indigo-400 text-[11px] opacity-0 group-hover:opacity-100 transition-opacity">
                Add →
              </span>
            </button>
          ))}

          {!loadingModels && !fetchError && models.length === 0 && (
            <div className="py-4 text-center text-zinc-500 text-[13px]">
              No models available.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
