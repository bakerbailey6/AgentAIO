import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useApprovals } from '../useApprovals'
import type { ApprovalRequest } from '@/lib/interfaces'

// useApprovals subscribes to TWO event types, so the bus mock stores a handler
// per type (mirrors the dual-handler pattern note in the testing plan).
const handlers: Record<string, ((event: unknown) => void) | undefined> = {}
const unsubRequested = vi.fn()
const unsubResolved = vi.fn()
const mockBus = {
  on: vi.fn((type: string, h: (e: unknown) => void) => {
    handlers[type] = h
    return type === 'agent:approval-requested' ? unsubRequested : unsubResolved
  }),
  off: vi.fn(),
  emit: vi.fn(),
}
vi.mock('@/lib/event-bus', () => ({ getEventBus: vi.fn(() => mockBus) }))

const makeRequest = (id: string): ApprovalRequest => ({
  id,
  agentId: 'a1',
  action: 'write_file',
  description: 'write to disk',
  risk: 'low',
})

const requested = (request: ApprovalRequest) => ({
  type: 'agent:approval-requested' as const,
  request,
  timestamp: 0,
})

const resolved = (requestId: string, approved: boolean) => ({
  type: 'agent:approval-resolved' as const,
  requestId,
  approved,
  timestamp: 0,
})

describe('useApprovals', () => {
  beforeEach(() => {
    handlers['agent:approval-requested'] = undefined
    handlers['agent:approval-resolved'] = undefined
    vi.clearAllMocks()
  })

  it('starts with an empty list', () => {
    const { result } = renderHook(() => useApprovals())
    expect(result.current).toEqual([])
  })

  it('subscribes to both approval-requested and approval-resolved', () => {
    renderHook(() => useApprovals())
    expect(mockBus.on).toHaveBeenCalledWith('agent:approval-requested', expect.any(Function))
    expect(mockBus.on).toHaveBeenCalledWith('agent:approval-resolved', expect.any(Function))
  })

  it('appends a request when agent:approval-requested fires', () => {
    const { result } = renderHook(() => useApprovals())
    const request = makeRequest('r1')
    act(() => handlers['agent:approval-requested']?.(requested(request)))
    expect(result.current).toEqual([request])
  })

  it('appends multiple requests in arrival order', () => {
    const { result } = renderHook(() => useApprovals())
    act(() => handlers['agent:approval-requested']?.(requested(makeRequest('r1'))))
    act(() => handlers['agent:approval-requested']?.(requested(makeRequest('r2'))))
    expect(result.current.map((a) => a.id)).toEqual(['r1', 'r2'])
  })

  it('removes a request by requestId when agent:approval-resolved fires', () => {
    const { result } = renderHook(() => useApprovals())
    act(() => handlers['agent:approval-requested']?.(requested(makeRequest('r1'))))
    act(() => handlers['agent:approval-requested']?.(requested(makeRequest('r2'))))
    act(() => handlers['agent:approval-resolved']?.(resolved('r1', true)))
    expect(result.current.map((a) => a.id)).toEqual(['r2'])
  })

  it('removes regardless of the approved flag', () => {
    const { result } = renderHook(() => useApprovals())
    act(() => handlers['agent:approval-requested']?.(requested(makeRequest('r1'))))
    act(() => handlers['agent:approval-resolved']?.(resolved('r1', false)))
    expect(result.current).toEqual([])
  })

  it('ignores a resolved event for an unknown requestId', () => {
    const { result } = renderHook(() => useApprovals())
    act(() => handlers['agent:approval-requested']?.(requested(makeRequest('r1'))))
    act(() => handlers['agent:approval-resolved']?.(resolved('does-not-exist', true)))
    expect(result.current.map((a) => a.id)).toEqual(['r1'])
  })

  it('unsubscribes from both events on unmount', () => {
    const { unmount } = renderHook(() => useApprovals())
    unmount()
    expect(unsubRequested).toHaveBeenCalledTimes(1)
    expect(unsubResolved).toHaveBeenCalledTimes(1)
  })
})
