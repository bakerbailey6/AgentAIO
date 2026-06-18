import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAgentActions } from '../useAgentActions'

let handler: ((event: unknown) => void) | null = null
const mockBus = {
  on: vi.fn((type: string, h: (e: unknown) => void) => { if (type === 'agent:action') handler = h; return () => { handler = null } }),
  off: vi.fn(),
  emit: vi.fn(),
}
vi.mock('@/lib/event-bus', () => ({ getEventBus: vi.fn(() => mockBus) }))

describe('useAgentActions', () => {
  beforeEach(() => { handler = null; vi.clearAllMocks() })

  it('starts empty', () => {
    const { result } = renderHook(() => useAgentActions('a1'))
    expect(result.current).toEqual([])
  })

  it('appends events for matching agentId', () => {
    const { result } = renderHook(() => useAgentActions('a1'))
    act(() => handler?.({ type: 'agent:action', agentId: 'a1', action: 'text', detail: 'hello', timestamp: 1 }))
    expect(result.current).toHaveLength(1)
    expect(result.current[0].detail).toBe('hello')
  })

  it('ignores events for other agentIds', () => {
    const { result } = renderHook(() => useAgentActions('a1'))
    act(() => handler?.({ type: 'agent:action', agentId: 'a2', action: 'text', detail: 'other', timestamp: 1 }))
    expect(result.current).toHaveLength(0)
  })

  it('caps at maxItems', () => {
    const { result } = renderHook(() => useAgentActions('a1', 3))
    act(() => {
      for (let i = 0; i < 5; i++) {
        handler?.({ type: 'agent:action', agentId: 'a1', action: 'text', detail: `item${i}`, timestamp: i })
      }
    })
    expect(result.current).toHaveLength(3)
    expect(result.current[2].detail).toBe('item4')
  })
})
