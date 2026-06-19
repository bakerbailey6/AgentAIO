'use client'
import { useState, useEffect, useCallback } from 'react'
import { getSecret, deleteSecret } from '@/lib/keychain'
import { PROVIDER_REGISTRY } from '@/lib/llm/providers/index'
import AddProviderForm from './AddProviderForm'
import ModelList from './ModelList'
import AddModelDialog from './AddModelDialog'
import CliProviderRow from './CliProviderRow'
import type { CliKind } from '@/lib/llm/cli/cli-invoke'

/** Maps a CLI provider id to the CLI it drives, for the sign-in rows. */
const CLI_KINDS: Record<string, CliKind> = { 'claude-cli': 'claude', 'codex-cli': 'codex' }

type SettingsSection = 'providers' | 'models'

interface SettingsPanelProps {
  onClose: () => void
}

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  ollama: 'Ollama (local)',
}

interface ProviderStatus {
  id: string
  displayName: string
  configured: boolean
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('providers')
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([])
  const [showAddProvider, setShowAddProvider] = useState(false)
  const [showAddModel, setShowAddModel] = useState(false)
  const [modelListKey, setModelListKey] = useState(0)

  const loadProviderStatuses = useCallback(async () => {
    // CLI subscription providers carry no keychain key — they have their own
    // sign-in section, so they're excluded from the API-key status list.
    const ids = Array.from(PROVIDER_REGISTRY.keys()).filter(
      (id) => PROVIDER_REGISTRY.get(id)?.authType !== 'cli',
    )
    const statuses = await Promise.all(
      ids.map(async (id) => {
        const secret = await getSecret(id + '-key').catch(() => null)
        return {
          id,
          displayName: PROVIDER_DISPLAY_NAMES[id] ?? id,
          configured: secret !== null,
        }
      }),
    )
    setProviderStatuses(statuses)
  }, [])

  useEffect(() => {
    void loadProviderStatuses()
  }, [loadProviderStatuses])

  async function handleRemoveProvider(id: string) {
    await deleteSecret(id + '-key')
    await loadProviderStatuses()
  }

  function handleProviderSaved() {
    setShowAddProvider(false)
    void loadProviderStatuses()
  }

  function handleModelAdded() {
    setShowAddModel(false)
    setModelListKey((k) => k + 1)
  }

  const NAV: Array<{ id: SettingsSection; label: string }> = [
    { id: 'providers', label: 'Providers' },
    { id: 'models', label: 'Models' },
  ]

  const cliProviders = Array.from(PROVIDER_REGISTRY.entries())
    .filter(([id, p]) => p.authType === 'cli' && CLI_KINDS[id])
    .map(([id, p]) => ({ id, displayName: p.displayName, kind: CLI_KINDS[id] }))

  return (
    <div className="absolute inset-0 bg-[#0a0a0b] flex z-20">
      {/* Left nav */}
      <div className="w-[60px] border-r border-white/[0.06] flex flex-col items-center py-4 gap-1 shrink-0">
        <button
          onClick={onClose}
          className="w-8 h-8 mb-3 flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-colors text-base leading-none"
          aria-label="Close settings"
        >
          ✕
        </button>
        {NAV.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveSection(item.id)}
            aria-label={item.label}
            title={item.label}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all text-[10px] font-semibold leading-none ${
              activeSection === item.id
                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06]'
            }`}
          >
            {item.id === 'providers' ? 'P' : 'M'}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-6 min-w-0">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-[18px] font-semibold text-zinc-200">Settings</h1>
          <p className="text-[13px] text-zinc-500 mt-0.5">
            {activeSection === 'providers' ? 'Manage API keys and provider connections' : 'Browse and add models'}
          </p>
        </div>

        {activeSection === 'providers' && (
          <div className="flex flex-col gap-4 max-w-xl">
            {/* Configured providers */}
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.06]">
                <span className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wide">Configured Providers</span>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {providerStatuses.filter((p) => p.configured).length === 0 && (
                  <div className="px-4 py-4 text-[13px] text-zinc-500">
                    No providers configured yet.
                  </div>
                )}
                {providerStatuses
                  .filter((p) => p.configured)
                  .map((p) => (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      <span className="text-[13px] text-zinc-200 flex-1">{p.displayName}</span>
                      <button
                        onClick={() => handleRemoveProvider(p.id)}
                        className="text-[11px] text-red-400 hover:text-red-300 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
              </div>
            </div>

            {/* Add provider form or button */}
            {showAddProvider ? (
              <AddProviderForm
                onSaved={handleProviderSaved}
                onCancel={() => setShowAddProvider(false)}
              />
            ) : (
              <button
                onClick={() => setShowAddProvider(true)}
                className="bg-white text-[#09090b] text-[12px] font-semibold rounded-lg px-3 py-1.5 hover:bg-zinc-100 transition-colors self-start"
              >
                Add Provider
              </button>
            )}

            {/* Subscription sign-in via the provider CLIs (no API key) */}
            {cliProviders.length > 0 && (
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.06]">
                  <span className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wide">
                    Subscription Sign-in
                  </span>
                  <p className="text-[11px] text-zinc-500 mt-0.5 normal-case font-normal">
                    Use your Claude or ChatGPT subscription via the official CLIs — no API key.
                  </p>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {cliProviders.map((p) => (
                    <CliProviderRow key={p.id} displayName={p.displayName} kind={p.kind} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeSection === 'models' && (
          <div className="flex flex-col gap-4 max-w-xl">
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.06]">
                <span className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wide">Configured Models</span>
              </div>
              <div className="px-2 py-2">
                <ModelList key={modelListKey} />
              </div>
            </div>

            {showAddModel ? (
              <AddModelDialog
                onAdded={handleModelAdded}
                onCancel={() => setShowAddModel(false)}
              />
            ) : (
              <button
                onClick={() => setShowAddModel(true)}
                className="bg-white text-[#09090b] text-[12px] font-semibold rounded-lg px-3 py-1.5 hover:bg-zinc-100 transition-colors self-start"
              >
                Add Model
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
