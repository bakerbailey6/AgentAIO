/**
 * Promise-based approval plumbing for the LLM tool-call loop.
 *
 * A tool's `execute` callback runs *inside* the AI SDK and cannot `yield` an
 * {@link AgentEvent}, so it can't surface an approval gate through the normal
 * provider event stream. Instead it calls {@link requestApproval}, which emits
 * `agent:approval-requested` on the event bus and returns a promise. The promise
 * stays pending until the provider's `approve`/`deny` (wired to
 * {@link resolveApproval}) settles it, at which point the tool either proceeds
 * or aborts. {@link abortSessionApprovals} denies everything outstanding for a
 * session when the provider is stopped.
 *
 * @module
 */
import { getEventBus } from '@/lib/event-bus'
import type { ApprovalRequest } from '@/lib/interfaces'

/** Inputs needed to raise a single approval gate. */
export interface RequestApprovalArgs {
  agentId: string
  sessionId: string
  /** Tool name, shown in the gate. */
  action: string
  description: string
  risk: 'low' | 'medium' | 'high'
}

/** One outstanding approval, keyed in {@link pending} by its request id. */
interface PendingApproval {
  resolve: (approved: boolean) => void
  sessionId: string
}

const pending = new Map<string, PendingApproval>()

/**
 * Emit `agent:approval-requested` with a fresh {@link ApprovalRequest} and
 * return a promise that resolves once the user (via the provider) decides.
 *
 * The pending entry is tracked by the generated request id and remembers its
 * `sessionId` so {@link abortSessionApprovals} can deny it when the session
 * stops.
 */
export async function requestApproval(args: RequestApprovalArgs): Promise<boolean> {
  const request: ApprovalRequest = {
    id: crypto.randomUUID(),
    agentId: args.agentId,
    action: args.action,
    description: args.description,
    risk: args.risk,
  }

  return new Promise<boolean>((resolve) => {
    pending.set(request.id, { resolve, sessionId: args.sessionId })
    getEventBus().emit({
      type: 'agent:approval-requested',
      request,
      timestamp: Date.now(),
    })
  })
}

/**
 * Settle a pending approval (`provider.approve` → `true`, `provider.deny` →
 * `false`). Resolves the awaited promise, drops the entry, and emits
 * `agent:approval-resolved`.
 *
 * @returns `true` if a pending entry existed for `requestId`, `false` otherwise.
 */
export function resolveApproval(requestId: string, approved: boolean): boolean {
  const entry = pending.get(requestId)
  if (!entry) return false

  pending.delete(requestId)
  entry.resolve(approved)
  getEventBus().emit({
    type: 'agent:approval-resolved',
    requestId,
    approved,
    timestamp: Date.now(),
  })
  return true
}

/**
 * Deny every pending approval belonging to `sessionId` (used by
 * `provider.stop`). Approvals from other sessions are left untouched.
 */
export function abortSessionApprovals(sessionId: string): void {
  for (const [requestId, entry] of pending) {
    if (entry.sessionId === sessionId) {
      resolveApproval(requestId, false)
    }
  }
}
