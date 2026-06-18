import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

const mockBus = { on: vi.fn(() => vi.fn()), emit: vi.fn(), off: vi.fn() }
vi.mock('@/lib/event-bus', () => ({ getEventBus: () => mockBus }))

import { useAgentStatus } from '../useAgentStatus'
import { useApprovals } from '../useApprovals'

describe('useAgentStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns idle initially', () => {
    const { result } = renderHook(() => useAgentStatus('agent-1'))
    expect(result.current).toBe('idle')
  })

  it('registers a listener on mount', () => {
    renderHook(() => useAgentStatus('agent-1'))
    expect(mockBus.on).toHaveBeenCalledWith('agent:status-changed', expect.any(Function))
  })
})

describe('useApprovals', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns empty array initially', () => {
    const { result } = renderHook(() => useApprovals())
    expect(result.current).toEqual([])
  })

  it('registers listeners for approval-requested and approval-resolved on mount', () => {
    renderHook(() => useApprovals())
    expect(mockBus.on).toHaveBeenCalledWith('agent:approval-requested', expect.any(Function))
    expect(mockBus.on).toHaveBeenCalledWith('agent:approval-resolved', expect.any(Function))
  })
})
