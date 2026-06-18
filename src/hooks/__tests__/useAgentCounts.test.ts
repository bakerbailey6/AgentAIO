import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAgentCounts } from '../useAgentCounts'

let handler: ((event: unknown) => void) | null = null
const mockBus = {
  on: vi.fn((type: string, h: (e: unknown) => void) => { if (type === 'agent:status-changed') handler = h; return () => { handler = null } }),
  off: vi.fn(),
  emit: vi.fn(),
}
vi.mock('@/lib/event-bus', () => ({ getEventBus: vi.fn(() => mockBus) }))

describe('useAgentCounts', () => {
  beforeEach(() => { handler = null; vi.clearAllMocks() })

  it('starts at 0/0/0', () => {
    const { result } = renderHook(() => useAgentCounts())
    expect(result.current).toEqual({ running: 0, idle: 0, awaitingApproval: 0 })
  })

  it('increments running when agent status changes to running', () => {
    const { result } = renderHook(() => useAgentCounts())
    act(() => handler?.({ type: 'agent:status-changed', agentId: 'a1', status: 'running', timestamp: 0 }))
    expect(result.current.running).toBe(1)
    expect(result.current.idle).toBe(0)
  })

  it('reverts to idle when agent goes idle', () => {
    const { result } = renderHook(() => useAgentCounts())
    act(() => handler?.({ type: 'agent:status-changed', agentId: 'a1', status: 'running', timestamp: 0 }))
    act(() => handler?.({ type: 'agent:status-changed', agentId: 'a1', status: 'idle', timestamp: 0 }))
    expect(result.current.running).toBe(0)
    expect(result.current.idle).toBe(1)
  })

  it('counts multiple agents independently', () => {
    const { result } = renderHook(() => useAgentCounts())
    act(() => { handler?.({ type: 'agent:status-changed', agentId: 'a1', status: 'running', timestamp: 0 }) })
    act(() => { handler?.({ type: 'agent:status-changed', agentId: 'a2', status: 'running', timestamp: 0 }) })
    act(() => { handler?.({ type: 'agent:status-changed', agentId: 'a3', status: 'idle', timestamp: 0 }) })
    expect(result.current.running).toBe(2)
    expect(result.current.idle).toBe(1)
  })
})
