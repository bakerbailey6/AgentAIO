import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

const mockBus = { on: vi.fn(() => vi.fn()), emit: vi.fn(), off: vi.fn() }
vi.mock('@/lib/event-bus', () => ({ getEventBus: () => mockBus }))

import { useAgentStatus } from '../useAgentStatus'

describe('useAgentStatus', () => {
  it('returns idle initially', () => {
    const { result } = renderHook(() => useAgentStatus('agent-1'))
    expect(result.current).toBe('idle')
  })

  it('registers a listener on mount', () => {
    renderHook(() => useAgentStatus('agent-1'))
    expect(mockBus.on).toHaveBeenCalledWith('agent:status-changed', expect.any(Function))
  })
})
