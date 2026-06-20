// src/components/agents/CreateAgentPanel.tsx
'use client'
import { useEffect, useState } from 'react'
import { initDb, AgentRepository, ModelRepository } from '@/lib/storage'
import type { AgentRow, ModelRow } from '@/lib/storage'

interface CreateAgentPanelProps {
  open: boolean
  onClose: () => void
  onCreated: (row: AgentRow) => void
  /** Navigate to the Settings panel (used by the empty-model link). */
  onNavigateToSettings?: () => void
}

type AgentType = 'llm' | 'coding-agent' | 'custom'

const AGENT_TYPES: { label: string; value: AgentType }[] = [
  { label: 'LLM', value: 'llm' },
  { label: 'Claude Code', value: 'coding-agent' },
  { label: 'Codex', value: 'custom' },
]

export default function CreateAgentPanel({ open, onClose, onCreated, onNavigateToSettings }: CreateAgentPanelProps) {
  const [name, setName] = useState('')
  const [agentType, setAgentType] = useState<AgentType>('llm')
  const [models, setModels] = useState<ModelRow[]>([])
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [nameError, setNameError] = useState(false)

  useEffect(() => {
    if (!open) return
    // Reset form when opened
    setName('')
    setAgentType('llm')
    setSystemPrompt('')
    setNameError(false)

    initDb()
      .then((db) => new ModelRepository(db).findAll())
      .then((rows) => {
        setModels(rows)
        setSelectedModelId(rows[0]?.id ?? null)
      })
      .catch(console.error)
  }, [open])

  if (!open) return null

  const handleSubmit = async () => {
    if (!name.trim()) {
      setNameError(true)
      return
    }
    setSubmitting(true)
    try {
      const db = await initDb()
      const agentRepo = new AgentRepository(db)
      const existing = await agentRepo.findAll()
      const id = await agentRepo.create({
        name: name.trim(),
        type: agentType,
        modelId: agentType === 'llm' ? (selectedModelId ?? null) : null,
        systemPrompt: agentType === 'llm' ? systemPrompt.trim() : '',
        toolIds: [],
        mcpIds: [],
        canvasX: 120,
        canvasY: 120 + existing.length * 220,
        groupId: null,
      })
      const row = await agentRepo.findById(id)
      if (row) {
        onCreated(row)
      }
      onClose()
    } catch (err) {
      console.error('Failed to create agent', err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="absolute inset-y-0 right-0 w-96 bg-[#0d0d0f] border-l border-white/[0.08] z-20 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
        <span className="text-[14px] font-semibold text-zinc-100">New Agent</span>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-300 transition-colors text-[16px] leading-none"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {/* Name */}
        <div className="px-5 py-4 border-b border-white/[0.05]">
          <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setNameError(false) }}
            placeholder="Agent name"
            className={`w-full bg-white/[0.05] border rounded-lg px-3 py-2 text-[13px] text-zinc-200 focus:outline-none placeholder:text-zinc-600 ${
              nameError ? 'border-red-500/50' : 'border-white/[0.08] focus:border-indigo-500/50'
            }`}
          />
          {nameError && (
            <p className="text-[11px] text-red-400 mt-1">Name is required</p>
          )}
        </div>

        {/* Type */}
        <div className="px-5 py-4 border-b border-white/[0.05]">
          <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">
            Type
          </label>
          <div className="flex gap-1 p-1 bg-white/[0.03] rounded-lg border border-white/[0.06]">
            {AGENT_TYPES.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setAgentType(value)}
                className={`flex-1 px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors ${
                  agentType === value
                    ? 'bg-white/[0.10] text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Model (LLM only) */}
        {agentType === 'llm' && (
          <div className="px-5 py-4 border-b border-white/[0.05]">
            <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">
              Model
            </label>
            {models.length === 0 ? (
              <p className="text-[12px] text-zinc-500">
                No models configured —{' '}
                <button
                  type="button"
                  onClick={() => onNavigateToSettings?.()}
                  className="text-indigo-400 cursor-pointer hover:text-indigo-300"
                >
                  add one in Settings
                </button>
              </p>
            ) : (
              <select
                value={selectedModelId ?? ''}
                onChange={(e) => setSelectedModelId(e.target.value || null)}
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-zinc-200 focus:outline-none focus:border-indigo-500/50"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* System Prompt (LLM only) */}
        {agentType === 'llm' && (
          <div className="px-5 py-4">
            <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">
              System Prompt
            </label>
            <textarea
              rows={4}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are a helpful assistant."
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-zinc-200 focus:outline-none focus:border-indigo-500/50 placeholder:text-zinc-600 resize-none"
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/[0.08] flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="bg-white text-[#09090b] text-[12px] font-semibold rounded-lg px-4 py-2 hover:bg-zinc-100 disabled:opacity-40 transition-colors"
        >
          {submitting ? 'Creating…' : 'Create'}
        </button>
      </div>
    </div>
  )
}
