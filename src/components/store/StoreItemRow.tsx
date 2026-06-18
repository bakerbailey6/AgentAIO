// src/components/store/StoreItemRow.tsx
'use client'
interface StoreItemRowProps {
  name: string
  description: string
  version: string
  installed: boolean
  assignedAgents: string[]
  onInstall: () => void
  onUninstall: () => void
}

export function StoreItemRow({ name, description, version, installed, assignedAgents, onInstall, onUninstall }: StoreItemRowProps) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.03] border-b border-white/[0.05] last:border-0 transition-colors">
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
      </div>
      <button
        onClick={installed ? onUninstall : onInstall}
        className={installed
          ? 'text-[11px] font-medium text-red-400 border border-red-500/30 rounded-md px-2.5 py-1 hover:bg-red-500/10 transition-all shrink-0'
          : 'text-[11px] font-medium text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 rounded-md px-2.5 py-1 hover:bg-indigo-500/10 transition-all shrink-0'
        }
      >
        {installed ? 'Remove' : 'Install'}
      </button>
    </div>
  )
}
