'use client'
interface TopBarProps {
  approvalCount: number
  onAddAgent: () => void
}

export function TopBar({ approvalCount, onAddAgent }: TopBarProps) {
  return (
    <header className="h-11 bg-[#09090b]/80 backdrop-blur-xl border-b border-white/[0.06] flex items-center px-4 gap-3 shrink-0">
      <span className="text-[13px] font-medium text-zinc-400 tracking-tight">Agent Command Center</span>
      <div className="flex-1" />
      {approvalCount > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-500/10 border border-amber-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-[11px] text-amber-400 font-medium">{approvalCount} approval{approvalCount > 1 ? 's' : ''} needed</span>
        </div>
      )}
      <button
        onClick={onAddAgent}
        className="bg-white text-[#09090b] text-[12px] font-semibold rounded-lg px-3 py-1.5 hover:bg-zinc-100 transition-colors"
      >
        + New Agent
      </button>
    </header>
  )
}
