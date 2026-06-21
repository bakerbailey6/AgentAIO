// src/components/agents/EditAgentPanel.tsx
'use client'
import { useEffect, useState } from 'react'
import {
  initDb,
  AgentRepository,
  ModelRepository,
  ToolRepository,
  McpRepository,
} from '@/lib/storage'
import type { AgentRow, ModelRow } from '@/lib/storage'
import { loadSkills } from '@/lib/skills'
import type { Skill } from '@/lib/skills'
import { WorkspacePicker } from './WorkspacePicker'

interface EditAgentPanelProps {
  agentId: string
  onClose: () => void
  onSaved: (row: AgentRow) => void
  /** Navigate to the Settings panel (used by the empty-model link). */
  onNavigateToSettings?: () => void
}

/** Prefix marking a skill assignment inside the agent's `tool_ids`. */
const SKILL_PREFIX = 'skill:'

export default function EditAgentPanel({ agentId, onClose, onSaved, onNavigateToSettings }: EditAgentPanelProps) {
  const [name, setName] = useState('')
  const [agentType, setAgentType] = useState<AgentRow['type']>('llm')
  const [models, setModels] = useState<ModelRow[]>([])
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [projectDirectory, setProjectDirectory] = useState('')
  const [tools, setTools] = useState<{ id: string; name: string }[]>([])
  const [mcps, setMcps] = useState<{ id: string; name: string }[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([])
  const [selectedMcpIds, setSelectedMcpIds] = useState<string[]>([])
  const [selectedSkillFiles, setSelectedSkillFiles] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    initDb()
      .then(async (db) => {
        const [agent, modelRows, toolRows, mcpRows, skillRows] = await Promise.all([
          new AgentRepository(db).findById(agentId),
          new ModelRepository(db).findAll(),
          new ToolRepository(db).findAll(),
          new McpRepository(db).findAll(),
          loadSkills(),
        ])
        if (cancelled) return
        setModels(modelRows)
        setTools(toolRows.map((t) => ({ id: t.id, name: t.name })))
        setMcps(mcpRows.map((m) => ({ id: m.id, name: m.name })))
        setSkills(skillRows)
        if (agent) {
          setName(agent.name)
          setAgentType(agent.type)
          setSelectedModelId(agent.modelId)
          setSystemPrompt(agent.systemPrompt)
          setProjectDirectory(agent.projectDirectory ?? '')
          setSelectedToolIds(
            agent.toolIds.filter((id) => !id.startsWith(SKILL_PREFIX)),
          )
          setSelectedSkillFiles(
            agent.toolIds
              .filter((id) => id.startsWith(SKILL_PREFIX))
              .map((id) => id.slice(SKILL_PREFIX.length)),
          )
          setSelectedMcpIds(agent.mcpIds)
        }
      })
      .catch(console.error)
    return () => {
      cancelled = true
    }
  }, [agentId])

  if (!agentId) return null

  const toggle = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    id: string,
    next: boolean,
  ) => {
    setter((prev) => (next ? [...prev, id] : prev.filter((x) => x !== id)))
  }

  const handleSave = async () => {
    setSubmitting(true)
    try {
      const db = await initDb()
      const agentRepo = new AgentRepository(db)
      const skillIds = selectedSkillFiles.map((f) => `${SKILL_PREFIX}${f}`)
      await agentRepo.update(agentId, {
        name: name.trim(),
        modelId: selectedModelId ?? null,
        systemPrompt,
        projectDirectory: projectDirectory.trim() || null,
      })
      await agentRepo.updateToolIds(agentId, [...selectedToolIds, ...skillIds])
      await agentRepo.updateMcpIds(agentId, selectedMcpIds)
      const row = await agentRepo.findById(agentId)
      if (row) {
        onSaved(row)
      }
      onClose()
    } catch (err) {
      console.error('Failed to save agent', err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="absolute inset-y-0 right-0 w-96 bg-[#0d0d0f] border-l border-white/[0.08] z-20 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
        <span className="text-[14px] font-semibold text-zinc-100">Edit Agent</span>
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
            onChange={(e) => setName(e.target.value)}
            placeholder="Agent name"
            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-zinc-200 focus:outline-none focus:border-indigo-500/50 placeholder:text-zinc-600"
          />
        </div>

        {/* Workspace folder (all agent types) — gives the agent repo access */}
        <div className="px-5 py-4 border-b border-white/[0.05]">
          <WorkspacePicker
            value={projectDirectory}
            onChange={setProjectDirectory}
            hint={
              agentType === 'llm'
                ? 'Optional — set a repo/folder to give this agent read/search/edit/shell access, like Claude Code.'
                : 'The working directory the coding agent runs in.'
            }
          />
        </div>

        {/* Model */}
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

        {/* System Prompt */}
        <div className="px-5 py-4 border-b border-white/[0.05]">
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

        {/* Tools */}
        <div className="px-5 py-4 border-b border-white/[0.05]">
          <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">
            Tools
          </label>
          {tools.length === 0 ? (
            <p className="text-[11px] text-zinc-600">None installed</p>
          ) : (
            <div className="flex flex-col gap-1">
              {tools.map((t) => (
                <label
                  key={t.id}
                  className="flex items-center gap-2 text-[11px] text-zinc-300 cursor-pointer hover:text-zinc-100"
                >
                  <input
                    type="checkbox"
                    checked={selectedToolIds.includes(t.id)}
                    onChange={(e) => toggle(setSelectedToolIds, t.id, e.target.checked)}
                    className="accent-indigo-500 w-3.5 h-3.5"
                  />
                  {t.name}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* MCP Servers */}
        <div className="px-5 py-4 border-b border-white/[0.05]">
          <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">
            MCP Servers
          </label>
          {mcps.length === 0 ? (
            <p className="text-[11px] text-zinc-600">None installed</p>
          ) : (
            <div className="flex flex-col gap-1">
              {mcps.map((m) => (
                <label
                  key={m.id}
                  className="flex items-center gap-2 text-[11px] text-zinc-300 cursor-pointer hover:text-zinc-100"
                >
                  <input
                    type="checkbox"
                    checked={selectedMcpIds.includes(m.id)}
                    onChange={(e) => toggle(setSelectedMcpIds, m.id, e.target.checked)}
                    className="accent-indigo-500 w-3.5 h-3.5"
                  />
                  {m.name}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Skills */}
        <div className="px-5 py-4 border-b border-white/[0.05]">
          <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">
            Skills
          </label>
          {skills.length === 0 ? (
            <p className="text-[11px] text-zinc-600">None installed</p>
          ) : (
            <div className="flex flex-col gap-1">
              {skills.map((s) => (
                <label
                  key={s.fileName}
                  className="flex items-center gap-2 text-[11px] text-zinc-300 cursor-pointer hover:text-zinc-100"
                >
                  <input
                    type="checkbox"
                    checked={selectedSkillFiles.includes(s.fileName)}
                    onChange={(e) =>
                      toggle(setSelectedSkillFiles, s.fileName, e.target.checked)
                    }
                    className="accent-indigo-500 w-3.5 h-3.5"
                  />
                  {s.name}
                </label>
              ))}
            </div>
          )}
          <p className="text-[11px] text-zinc-600 mt-2">
            Install more tools/MCPs in the Store.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/[0.08] flex justify-end">
        <button
          onClick={handleSave}
          disabled={submitting}
          className="bg-white text-[#09090b] text-[12px] font-semibold rounded-lg px-4 py-2 hover:bg-zinc-100 disabled:opacity-40 transition-colors"
        >
          {submitting ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
