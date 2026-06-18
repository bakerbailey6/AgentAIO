'use client'
interface StatusBarProps {
  runningCount: number
  idleCount: number
  approvalCount: number
  llmCallsToday: number
  estimatedCost: number
  modelsConnected: number
  toolsActive: number
}

export function StatusBar(props: StatusBarProps) {
  return (
    <footer className="h-8 bg-[#09090b] border-t border-white/[0.06] flex items-center px-4 gap-5 shrink-0">
      <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        {props.runningCount} running
      </span>
      {props.approvalCount > 0 && (
        <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          {props.approvalCount} approvals
        </span>
      )}
      <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
        {props.idleCount} idle
      </span>
      <div className="flex-1" />
      <span className="text-[11px] text-zinc-500">{props.llmCallsToday} LLM calls · ~${props.estimatedCost.toFixed(2)}</span>
      <span className="text-[11px] text-zinc-500">{props.modelsConnected} models · {props.toolsActive} tools</span>
    </footer>
  )
}
