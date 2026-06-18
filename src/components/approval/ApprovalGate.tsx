'use client'
import type { ApprovalRequest } from '@/lib/interfaces'

const RISK_COLORS = {
  low: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400',
  medium: 'border-orange-500/40 bg-orange-500/10 text-orange-400',
  high: 'border-red-500/40 bg-red-500/10 text-red-400',
}

interface ApprovalGateProps {
  request: ApprovalRequest
  onApprove: (id: string) => void
  onDeny: (id: string) => void
}

export function ApprovalGate({ request, onApprove, onDeny }: ApprovalGateProps) {
  return (
    <div className={`mx-2 mb-2 px-2 py-1.5 rounded border ${RISK_COLORS[request.risk]}`}>
      <p className="text-[10px] font-semibold truncate">{request.action}</p>
      <p className="text-[9px] text-neutral-500 truncate mb-1.5">{request.description}</p>
      <div className="flex gap-1">
        <button
          onClick={() => onApprove(request.id)}
          className="flex-1 py-0.5 rounded bg-green-500 hover:bg-green-400 text-[10px] text-black font-bold"
        >
          ✓ Approve
        </button>
        <button
          onClick={() => onDeny(request.id)}
          className="flex-1 py-0.5 rounded border border-red-500/40 hover:bg-red-500/20 text-[10px] text-red-400"
        >
          ✕ Deny
        </button>
      </div>
    </div>
  )
}
