// src/components/store/StoreItemRow.tsx
'use client'
import { useState } from 'react'

interface StoreItemRowProps {
  name: string
  description: string
  version: string
  installed: boolean
  assignedAgents?: string[]
  installing?: boolean
  /** Hide the Install/Remove button (e.g. skills, which are always present). */
  showInstallButton?: boolean
  onInstall: () => void
  onUninstall: () => void
  /** When set, render an "Assign" expander listing these agents. */
  agents?: Array<{ id: string; name: string }>
  /** Ids of agents this item is currently assigned to (drives the checkboxes). */
  assignedAgentIds?: string[]
  /** Toggle assignment of this item for one agent. */
  onToggleAgent?: (agentId: string, next: boolean) => void
}

export function StoreItemRow({
  name,
  description,
  version,
  installed,
  assignedAgents = [],
  installing,
  showInstallButton = true,
  onInstall,
  onUninstall,
  agents,
  assignedAgentIds = [],
  onToggleAgent,
}: StoreItemRowProps) {
  const [expanded, setExpanded] = useState(false)
  const canAssign = !!agents && !!onToggleAgent

  return (
    <div className="border-b border-white/[0.05] last:border-0">
      <div className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors">
        <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center text-zinc-400 shrink-0 mt-0.5">
          <span className="text-[13px]">⬡</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-zinc-200 truncate">{name}</span>
            <span className="text-[10px] text-zinc-600 bg-white/[0.04] rounded px-1.5 py-0.5 shrink-0">v{version}</span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{description}</p>
          {assignedAgents.length > 0 && (
            <p className="text-[10px] text-indigo-400/70 mt-0.5">Assigned to: {assignedAgents.join(', ')}</p>
          )}
          {canAssign && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="mt-1 text-[10px] font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              {expanded ? 'Hide agents ▴' : 'Assign ▾'}
            </button>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {installing ? (
            <div className="animate-spin w-3.5 h-3.5 rounded-full border-2 border-indigo-500 border-t-transparent" />
          ) : (
            showInstallButton && (
              <button
                onClick={installed ? onUninstall : onInstall}
                className={installed
                  ? 'text-[11px] font-medium text-red-400 border border-red-500/30 rounded-md px-2.5 py-1 hover:bg-red-500/10 transition-all'
                  : 'text-[11px] font-medium text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 rounded-md px-2.5 py-1 hover:bg-indigo-500/10 transition-all'
                }
              >
                {installed ? 'Remove' : 'Install'}
              </button>
            )
          )}
        </div>
      </div>
      {canAssign && expanded && (
        <div className="px-4 pb-3 pl-[3.75rem]">
          {agents!.length === 0 ? (
            <p className="text-[11px] text-zinc-600">No agents yet. Create one to assign this.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {agents!.map((agent) => {
                const assigned = assignedAgentIds.includes(agent.id)
                return (
                  <label
                    key={agent.id}
                    className="flex items-center gap-2 text-[11px] text-zinc-300 cursor-pointer hover:text-zinc-100"
                  >
                    <input
                      type="checkbox"
                      checked={assigned}
                      onChange={(e) => onToggleAgent!(agent.id, e.target.checked)}
                      className="accent-indigo-500 w-3.5 h-3.5"
                    />
                    {agent.name}
                  </label>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
