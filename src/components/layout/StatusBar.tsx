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
    <footer className="h-[32px] bg-[#0a0b14] border-t border-[#1e2030] flex items-center px-4 gap-6 shrink-0">
      <span className="text-[11px] text-green-400">● {props.runningCount} running</span>
      {props.approvalCount > 0 && (
        <span className="text-[11px] text-red-400">⚠ {props.approvalCount} approvals</span>
      )}
      <span className="text-[11px] text-neutral-600">⏸ {props.idleCount} idle</span>
      <div className="flex-1" />
      <span className="text-[11px] text-neutral-600">{props.llmCallsToday} LLM calls · ~${props.estimatedCost.toFixed(2)}</span>
      <span className="text-[11px] text-neutral-600">{props.modelsConnected} models · {props.toolsActive} tools</span>
    </footer>
  )
}
