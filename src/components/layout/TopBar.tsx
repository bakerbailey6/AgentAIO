'use client'
interface TopBarProps {
  approvalCount: number
  onAddAgent: () => void
}

export function TopBar({ approvalCount, onAddAgent }: TopBarProps) {
  return (
    <header className="h-[44px] bg-[#0a0b14] border-b border-[#1e2030] flex items-center px-4 gap-3 shrink-0">
      <div>
        <p className="text-[9px] text-neutral-600 uppercase tracking-widest leading-none">Agent Command Center</p>
        <p className="text-[13px] text-neutral-100 font-semibold leading-tight">Mission Control</p>
      </div>
      <div className="flex-1" />
      {approvalCount > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-red-500/10 border border-red-500/40">
          <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
          <span className="text-[11px] text-red-400 font-semibold">{approvalCount} approval{approvalCount > 1 ? 's' : ''} needed</span>
        </div>
      )}
      <button
        onClick={onAddAgent}
        className="px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 text-white text-[12px] font-medium transition-colors"
      >
        + Agent
      </button>
    </header>
  )
}
