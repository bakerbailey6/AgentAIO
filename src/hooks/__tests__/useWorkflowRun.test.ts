import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useWorkflowRun } from '../useWorkflowRun'
import type { WorkflowNodeStatusEvent, WorkflowRunFinishedEvent } from '@/lib/interfaces'

// Functional pub/sub bus so the hook actually receives emitted events: `on`
// registers a handler (and returns an unsubscribe that removes it); `emit`
// invokes every handler registered for that event type.
const { busOn, busEmit } = vi.hoisted(() => {
  type Handler = (event: unknown) => void
  const listeners = new Map<string, Set<Handler>>()
  const busOn = vi.fn((type: string, handler: Handler) => {
    if (!listeners.has(type)) listeners.set(type, new Set())
    listeners.get(type)!.add(handler)
    return () => listeners.get(type)?.delete(handler)
  })
  const busEmit = (event: { type: string }) => {
    listeners.get(event.type)?.forEach((h) => h(event))
  }
  return { busOn, busEmit }
})

vi.mock('@/lib/event-bus', () => ({
  getEventBus: vi.fn(() => ({ emit: busEmit, on: busOn, off: vi.fn() })),
}))

function nodeStatus(
  partial: Partial<WorkflowNodeStatusEvent> & Pick<WorkflowNodeStatusEvent, 'runId' | 'nodeId' | 'status'>,
): WorkflowNodeStatusEvent {
  return { type: 'workflow:node-status', timestamp: Date.now(), ...partial }
}

function runFinished(
  partial: Partial<WorkflowRunFinishedEvent> & Pick<WorkflowRunFinishedEvent, 'runId' | 'status'>,
): WorkflowRunFinishedEvent {
  return { type: 'workflow:run-finished', timestamp: Date.now(), ...partial }
}

describe('useWorkflowRun', () => {
  beforeEach(() => vi.clearAllMocks())

  it('starts idle with empty state when runId is null', () => {
    const { result } = renderHook(() => useWorkflowRun(null))
    expect(result.current).toEqual({
      runId: null,
      status: 'idle',
      nodeStatus: {},
      result: undefined,
    })
  })

  it('starts running for a real runId', () => {
    const { result } = renderHook(() => useWorkflowRun('run-1'))
    expect(result.current.runId).toBe('run-1')
    expect(result.current.status).toBe('running')
    expect(result.current.nodeStatus).toEqual({})
  })

  it('updates nodeStatus on a workflow:node-status event for the active run', () => {
    const { result } = renderHook(() => useWorkflowRun('run-1'))

    act(() => {
      busEmit(nodeStatus({ runId: 'run-1', nodeId: 'n1', status: 'running' }))
    })
    expect(result.current.nodeStatus).toEqual({ n1: 'running' })
    expect(result.current.status).toBe('running')

    act(() => {
      busEmit(nodeStatus({ runId: 'run-1', nodeId: 'n1', status: 'done' }))
      busEmit(nodeStatus({ runId: 'run-1', nodeId: 'n2', status: 'running' }))
    })
    expect(result.current.nodeStatus).toEqual({ n1: 'done', n2: 'running' })
  })

  it('updates status and result on a workflow:run-finished event for the active run', () => {
    const { result } = renderHook(() => useWorkflowRun('run-1'))

    act(() => {
      busEmit(runFinished({ runId: 'run-1', status: 'done', result: { answer: 42 } }))
    })
    expect(result.current.status).toBe('done')
    expect(result.current.result).toEqual({ answer: 42 })
  })

  it('reflects an error finish', () => {
    const { result } = renderHook(() => useWorkflowRun('run-1'))

    act(() => {
      busEmit(runFinished({ runId: 'run-1', status: 'error' }))
    })
    expect(result.current.status).toBe('error')
    expect(result.current.result).toBeUndefined()
  })

  it('ignores events for a different runId', () => {
    const { result } = renderHook(() => useWorkflowRun('run-1'))

    act(() => {
      busEmit(nodeStatus({ runId: 'other-run', nodeId: 'n1', status: 'running' }))
      busEmit(runFinished({ runId: 'other-run', status: 'done', result: 'nope' }))
    })
    expect(result.current.nodeStatus).toEqual({})
    expect(result.current.status).toBe('running')
    expect(result.current.result).toBeUndefined()
  })

  it('resets state when runId changes', () => {
    const { result, rerender } = renderHook(({ id }: { id: string | null }) => useWorkflowRun(id), {
      initialProps: { id: 'run-1' as string | null },
    })

    act(() => {
      busEmit(nodeStatus({ runId: 'run-1', nodeId: 'n1', status: 'done' }))
      busEmit(runFinished({ runId: 'run-1', status: 'done', result: 'first' }))
    })
    expect(result.current.nodeStatus).toEqual({ n1: 'done' })
    expect(result.current.result).toBe('first')

    rerender({ id: 'run-2' })
    expect(result.current).toEqual({
      runId: 'run-2',
      status: 'running',
      nodeStatus: {},
      result: undefined,
    })

    // The new run only responds to its own events, not the old run's.
    act(() => {
      busEmit(nodeStatus({ runId: 'run-1', nodeId: 'stale', status: 'done' }))
      busEmit(nodeStatus({ runId: 'run-2', nodeId: 'n9', status: 'running' }))
    })
    expect(result.current.nodeStatus).toEqual({ n9: 'running' })

    // Switching back to null resets to idle.
    rerender({ id: null })
    expect(result.current).toEqual({
      runId: null,
      status: 'idle',
      nodeStatus: {},
      result: undefined,
    })
  })
})
