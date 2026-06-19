'use client'
import { useMemo, useState } from 'react'
import { StoreItemRow } from './StoreItemRow'
import { useInstalledMcps } from '@/hooks/useInstalledMcps'
import { useInstalledTools } from '@/hooks/useInstalledTools'
import { useSkills } from '@/hooks/useSkills'
import { useAgentAssignments } from '@/hooks/useAgentAssignments'
import { listBuiltInTools } from '@/lib/tools/registry'
import { MCP_CATALOG } from '@/lib/store/catalog'
import type { CatalogMcpEntry } from '@/lib/store/catalog'
import type { ToolDefinition } from '@/lib/interfaces'
import { initDb, McpRepository } from '@/lib/storage'

type Tab = 'mcps' | 'tools' | 'skills'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'mcps', label: 'MCP Servers' },
  { id: 'tools', label: 'Tools' },
  { id: 'skills', label: 'Skills' },
]

/** Assignment id for a skill, distinguishing it from tool ids in `tool_ids`. */
const skillId = (fileName: string) => `skill:${fileName}`

interface StorePanelProps {
  onClose: () => void
}

export function StorePanel({ onClose }: StorePanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('mcps')
  const [installingName, setInstallingName] = useState<string | null>(null)
  const [footerInput, setFooterInput] = useState('')
  const [query, setQuery] = useState('')

  const mcpStore = useInstalledMcps()
  const toolStore = useInstalledTools()
  const skillStore = useSkills()
  const assignments = useAgentAssignments()

  const builtInTools = useMemo(() => listBuiltInTools(), [])
  const agentList = useMemo(
    () => assignments.agents.map((a) => ({ id: a.id, name: a.name })),
    [assignments.agents],
  )

  const matches = (...fields: string[]) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return fields.some((f) => f.toLowerCase().includes(q))
  }

  async function handleMcpInstall(entry: CatalogMcpEntry) {
    setInstallingName(entry.name)
    try {
      await mcpStore.install(entry)
    } finally {
      setInstallingName(null)
    }
  }

  async function handleToolInstall(tool: ToolDefinition) {
    setInstallingName(tool.name)
    try {
      await toolStore.install(tool)
    } finally {
      setInstallingName(null)
    }
  }

  async function handleFooterSubmit() {
    const value = footerInput.trim()
    if (!value) return
    if (activeTab === 'skills') {
      const fileName = value.endsWith('.md') ? value : `${value}.md`
      const base = fileName.replace(/\.md$/, '')
      const template = `---\nname: ${base}\ndescription: \nversion: 1.0.0\n---\n\n# ${base}\n`
      try {
        await skillStore.create(fileName, template)
      } catch {
        // Invalid name or no native backend — ignore.
      }
    } else {
      // MCP install-from-command (skills handled above; tools install inline).
      const name = value.split(' ').pop() ?? value
      const db = await initDb()
      await new McpRepository(db).create({
        name,
        transport: 'stdio',
        commandOrUrl: value,
        envVarsRef: [],
        enabled: true,
      })
    }
    setFooterInput('')
  }

  return (
    <div className="absolute inset-y-0 right-0 w-80 bg-[#0d0d0f] border-l border-white/[0.08] flex flex-col z-10 shadow-2xl shadow-black/40">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
        <span className="text-[13px] font-semibold text-zinc-200">Store</span>
        <div className="flex-1" />
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors text-base leading-none">✕</button>
      </div>
      {/* Tabs */}
      <div className="flex border-b border-white/[0.06]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 text-[12px] font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-zinc-200 border-b-2 border-indigo-500'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {/* Search */}
      <div className="px-4 py-2.5 border-b border-white/[0.06]">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          className="bg-white/[0.05] border border-white/[0.08] rounded-lg text-[12px] text-zinc-300 placeholder:text-zinc-600 px-3 py-1.5 w-full focus:outline-none focus:border-indigo-500/50 transition-colors"
        />
      </div>
      {/* Items list */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'mcps' && (
          MCP_CATALOG.filter((e) => matches(e.name, e.description)).map((entry) => (
            <StoreItemRow
              key={entry.name}
              name={entry.name}
              version={entry.version}
              description={entry.description}
              installed={mcpStore.isInstalled(entry.name)}
              installing={installingName === entry.name}
              onInstall={() => handleMcpInstall(entry)}
              onUninstall={() => {
                const row = mcpStore.mcps.find((m) => m.name === entry.name)
                if (row) mcpStore.uninstall(row.id)
              }}
            />
          ))
        )}

        {activeTab === 'tools' && (
          builtInTools.filter((t) => matches(t.name, t.description)).map((tool) => {
            const installed = toolStore.isInstalled(tool.name)
            const rowId = toolStore.installedId(tool.name)
            return (
              <StoreItemRow
                key={tool.name}
                name={tool.name}
                version={tool.version}
                description={tool.description}
                installed={installed}
                installing={installingName === tool.name}
                onInstall={() => handleToolInstall(tool)}
                onUninstall={() => {
                  if (rowId) toolStore.uninstall(rowId)
                }}
                agents={installed ? agentList : undefined}
                assignedAgents={rowId ? assignments.assignedAgentNames(rowId) : []}
                assignedAgentIds={rowId ? assignments.assignedAgentIds(rowId) : []}
                onToggleAgent={
                  installed && rowId
                    ? (agentId, next) => assignments.toggle(rowId, agentId, next)
                    : undefined
                }
              />
            )
          })
        )}

        {activeTab === 'skills' && (
          skillStore.skills.length === 0 ? (
            <div className="px-4 py-8 text-center text-zinc-600 text-[12px] leading-relaxed">
              No skills in ~/.acc/skills yet.<br />Drop a .md file there, or create one below.
            </div>
          ) : (
            skillStore.skills
              .filter((s) => matches(s.name, s.description, s.fileName))
              .map((skill) => {
                const id = skillId(skill.fileName)
                return (
                  <StoreItemRow
                    key={skill.fileName}
                    name={skill.name}
                    version={skill.version}
                    description={skill.description || skill.fileName}
                    installed
                    showInstallButton={false}
                    onInstall={() => {}}
                    onUninstall={() => {}}
                    agents={agentList}
                    assignedAgents={assignments.assignedAgentNames(id)}
                    assignedAgentIds={assignments.assignedAgentIds(id)}
                    onToggleAgent={(agentId, next) => assignments.toggle(id, agentId, next)}
                  />
                )
              })
          )
        )}
      </div>
      {/* Footer: contextual install / create */}
      {activeTab === 'tools' ? (
        <div className="px-4 py-3 border-t border-white/[0.06]">
          <p className="text-[11px] text-zinc-500">Install a built-in tool, then assign it to agents. Custom tools coming in a future update.</p>
        </div>
      ) : (
        <div className="px-4 py-3 border-t border-white/[0.06]">
          <p className="text-[11px] text-zinc-500 mb-2">
            {activeTab === 'skills' ? 'Create a skill' : 'Install from path or URL'}
          </p>
          <div className="flex gap-2">
            <input
              value={footerInput}
              onChange={(e) => setFooterInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleFooterSubmit()
              }}
              placeholder={activeTab === 'skills' ? 'my-skill.md' : 'npx @mcp/server or https://...'}
              className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
            />
            <button
              onClick={handleFooterSubmit}
              className="px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-[11px] font-semibold text-white transition-colors"
            >
              {activeTab === 'skills' ? 'Create' : 'Add'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
