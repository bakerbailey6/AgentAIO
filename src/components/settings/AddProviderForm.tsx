'use client'
import { useState } from 'react'
import { PROVIDER_REGISTRY } from '@/lib/llm/providers/index'
import { setSecret } from '@/lib/keychain'

interface AddProviderFormProps {
  onSaved: () => void
  onCancel: () => void
}

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  ollama: 'Ollama (local)',
}

export default function AddProviderForm({ onSaved, onCancel }: AddProviderFormProps) {
  // CLI subscription providers don't take an API key — they're managed in the
  // Subscription Sign-in section, so they're excluded from this key-entry form.
  const providerIds = Array.from(PROVIDER_REGISTRY.keys()).filter(
    (id) => PROVIDER_REGISTRY.get(id)?.authType !== 'cli',
  )
  const [selectedProvider, setSelectedProvider] = useState(providerIds[0] ?? 'anthropic')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('http://localhost:11434')
  const [testResult, setTestResult] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)

  const isOllama = selectedProvider === 'ollama'

  async function handleSave() {
    setSaving(true)
    try {
      const keyValue = isOllama ? (baseUrl || 'http://localhost:11434') : apiKey
      await setSecret(selectedProvider + '-key', keyValue)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const provider = PROVIDER_REGISTRY.get(selectedProvider)
      if (!provider) {
        setTestResult('Provider not found')
        return
      }
      const credentials = isOllama
        ? { baseUrl: baseUrl || 'http://localhost:11434' }
        : { apiKey }
      const result = await provider.testConnection(credentials)
      if (result.success) {
        setTestResult(`Connected · ${result.latencyMs ?? 0}ms`)
      } else {
        setTestResult(`Failed: ${result.error ?? 'Unknown error'}`)
      }
    } catch (e) {
      setTestResult(`Failed: ${String(e)}`)
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 flex flex-col gap-3">
      <p className="text-[13px] font-semibold text-zinc-200">Add Provider</p>

      <div className="flex flex-col gap-1">
        <label className="text-[11px] text-zinc-500 uppercase tracking-wide">Provider</label>
        <select
          value={selectedProvider}
          onChange={(e) => {
            setSelectedProvider(e.target.value)
            setTestResult(null)
          }}
          className="bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-zinc-200 focus:outline-none focus:border-indigo-500/50 transition-colors"
        >
          {providerIds.map((id) => (
            <option key={id} value={id} className="bg-[#0d0d0f] text-zinc-200">
              {PROVIDER_DISPLAY_NAMES[id] ?? id}
            </option>
          ))}
        </select>
      </div>

      {!isOllama && (
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-zinc-500 uppercase tracking-wide">API Key</label>
          <input
            type="password"
            placeholder="API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
          />
        </div>
      )}

      {isOllama && (
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-zinc-500 uppercase tracking-wide">Base URL</label>
          <input
            type="text"
            placeholder="http://localhost:11434"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
          />
        </div>
      )}

      {testResult && (
        <p className={`text-[12px] ${testResult.startsWith('Connected') ? 'text-emerald-400' : 'text-red-400'}`}>
          {testResult}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-white text-[#09090b] text-[12px] font-semibold rounded-lg px-3 py-1.5 hover:bg-zinc-100 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={handleTest}
          disabled={testing}
          className="text-zinc-400 hover:text-zinc-200 text-[12px] border border-white/[0.08] rounded-lg px-3 py-1.5 hover:bg-white/[0.04] transition-colors disabled:opacity-50"
        >
          {testing ? 'Testing…' : 'Test'}
        </button>
        <button
          onClick={onCancel}
          className="text-zinc-400 hover:text-zinc-200 text-[12px] border border-white/[0.08] rounded-lg px-3 py-1.5 hover:bg-white/[0.04] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
