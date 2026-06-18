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
    <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1e2030] hover:bg-[#13141f] transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-neutral-100">{name}</span>
          <span className="text-[10px] text-neutral-600">v{version}</span>
        </div>
        <p className="text-[11px] text-neutral-500 truncate">{description}</p>
        {assignedAgents.length > 0 && (
          <p className="text-[10px] text-violet-400/70 mt-0.5">Assigned to: {assignedAgents.join(', ')}</p>
        )}
      </div>
      <button
        onClick={installed ? onUninstall : onInstall}
        className={installed
          ? 'px-2.5 py-1 text-[11px] rounded border border-neutral-700 text-neutral-500 hover:border-red-500/50 hover:text-red-400 transition-colors'
          : 'px-2.5 py-1 text-[11px] rounded bg-violet-600 hover:bg-violet-500 text-white transition-colors'
        }
      >
        {installed ? 'Remove' : 'Install'}
      </button>
    </div>
  )
}
