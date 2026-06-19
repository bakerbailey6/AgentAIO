import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AppEvent } from '@/lib/interfaces'

const emitMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/event-bus', () => ({
  getEventBus: () => ({ emit: emitMock }),
}))

import {
  requestApproval,
  resolveApproval,
  abortSessionApprovals,
  type RequestApprovalArgs,
} from '../approval-gate'

const baseArgs: RequestApprovalArgs = {
  agentId: 'agent-1',
  sessionId: 'session-1',
  action: 'shell',
  description: 'Run `ls`',
  risk: 'medium',
}

/** Pull the emitted events of a given type out of the emit spy. */
function emittedOfType<T extends AppEvent['type']>(type: T): Extract<AppEvent, { type: T }>[] {
  return emitMock.mock.calls
    .map((call) => call[0] as AppEvent)
    .filter((e): e is Extract<AppEvent, { type: T }> => e.type === type)
}

beforeEach(() => {
  emitMock.mockClear()
  // Drain any approvals left pending by a prior test so they don't leak.
  abortSessionApprovals('session-1')
  abortSessionApprovals('session-2')
  emitMock.mockClear()
})

describe('requestApproval', () => {
  it('emits agent:approval-requested with a well-formed ApprovalRequest and returns a pending promise', () => {
    let settled = false
    const promise = requestApproval(baseArgs)
    promise.then(() => {
      settled = true
    })

    const requested = emittedOfType('agent:approval-requested')
    expect(requested).toHaveLength(1)
    const { request, timestamp } = requested[0]
    expect(typeof request.id).toBe('string')
    expect(request.id.length).toBeGreaterThan(0)
    expect(request.agentId).toBe('agent-1')
    expect(request.action).toBe('shell')
    expect(request.description).toBe('Run `ls`')
    expect(request.risk).toBe('medium')
    expect(typeof timestamp).toBe('number')

    // The promise must still be pending (no decision yet).
    expect(settled).toBe(false)

    // Clean up the pending entry.
    resolveApproval(request.id, true)
    return promise
  })
})

describe('resolveApproval', () => {
  it('resolves the awaited requestApproval promise to true and emits agent:approval-resolved', async () => {
    const promise = requestApproval(baseArgs)
    const requestId = emittedOfType('agent:approval-requested')[0].request.id

    const existed = resolveApproval(requestId, true)
    expect(existed).toBe(true)

    await expect(promise).resolves.toBe(true)

    const resolved = emittedOfType('agent:approval-resolved')
    expect(resolved).toHaveLength(1)
    expect(resolved[0].requestId).toBe(requestId)
    expect(resolved[0].approved).toBe(true)
    expect(typeof resolved[0].timestamp).toBe('number')
  })

  it('resolves the awaited requestApproval promise to false and emits agent:approval-resolved', async () => {
    const promise = requestApproval(baseArgs)
    const requestId = emittedOfType('agent:approval-requested')[0].request.id

    const existed = resolveApproval(requestId, false)
    expect(existed).toBe(true)

    await expect(promise).resolves.toBe(false)

    const resolved = emittedOfType('agent:approval-resolved')
    expect(resolved).toHaveLength(1)
    expect(resolved[0].requestId).toBe(requestId)
    expect(resolved[0].approved).toBe(false)
  })

  it('returns false and does not emit for an unknown request id', () => {
    const existed = resolveApproval('unknown', true)
    expect(existed).toBe(false)
    expect(emittedOfType('agent:approval-resolved')).toHaveLength(0)
  })
})

describe('abortSessionApprovals', () => {
  it('resolves all pending approvals for a session to false, emits a resolved event for each, and leaves other sessions untouched', async () => {
    const a = requestApproval({ ...baseArgs, sessionId: 'session-1' })
    const idA = emittedOfType('agent:approval-requested')[0].request.id
    const b = requestApproval({ ...baseArgs, sessionId: 'session-1' })
    const idB = emittedOfType('agent:approval-requested')[1].request.id
    const other = requestApproval({ ...baseArgs, sessionId: 'session-2' })
    const idOther = emittedOfType('agent:approval-requested')[2].request.id

    let otherSettled = false
    other.then(() => {
      otherSettled = true
    })

    abortSessionApprovals('session-1')

    await expect(a).resolves.toBe(false)
    await expect(b).resolves.toBe(false)

    const resolved = emittedOfType('agent:approval-resolved')
    expect(resolved).toHaveLength(2)
    const resolvedIds = resolved.map((e) => e.requestId).sort()
    expect(resolvedIds).toEqual([idA, idB].sort())
    expect(resolved.every((e) => e.approved === false)).toBe(true)

    // The other session's approval is still pending.
    expect(otherSettled).toBe(false)

    // resolveApproval should still find the untouched session-2 entry.
    expect(resolveApproval(idOther, true)).toBe(true)
    await expect(other).resolves.toBe(true)
  })
})
