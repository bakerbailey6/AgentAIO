import { describe, it, expect, vi } from 'vitest'
import { createEventBus } from '@/lib/event-bus'
import type { AgentStatusChangedEvent } from '@/lib/interfaces'

describe('createEventBus', () => {
  it('calls handler when matching event is emitted', () => {
    const bus = createEventBus()
    const handler = vi.fn()
    bus.on('agent:status-changed', handler)
    const event: AgentStatusChangedEvent = {
      type: 'agent:status-changed',
      agentId: 'a1',
      status: 'running',
      timestamp: Date.now(),
    }
    bus.emit(event)
    expect(handler).toHaveBeenCalledWith(event)
  })

  it('does not call handler for different event type', () => {
    const bus = createEventBus()
    const handler = vi.fn()
    bus.on('agent:status-changed', handler)
    bus.emit({ type: 'canvas:layout-changed', timestamp: Date.now() })
    expect(handler).not.toHaveBeenCalled()
  })

  it('unsubscribes when returned function is called', () => {
    const bus = createEventBus()
    const handler = vi.fn()
    const unsub = bus.on('agent:status-changed', handler)
    unsub()
    bus.emit({ type: 'agent:status-changed', agentId: 'a1', status: 'idle', timestamp: Date.now() })
    expect(handler).not.toHaveBeenCalled()
  })

  it('supports multiple handlers for the same event', () => {
    const bus = createEventBus()
    const h1 = vi.fn()
    const h2 = vi.fn()
    bus.on('agent:action', h1)
    bus.on('agent:action', h2)
    bus.emit({ type: 'agent:action', agentId: 'a1', action: 'read', detail: 'file.ts', timestamp: Date.now() })
    expect(h1).toHaveBeenCalledOnce()
    expect(h2).toHaveBeenCalledOnce()
  })

  it('delivers workflow:node-status events to their listener', () => {
    const bus = createEventBus()
    const handler = vi.fn()
    bus.on('workflow:node-status', handler)
    bus.emit({ type: 'workflow:node-status', runId: 'r1', nodeId: 'n1', status: 'running', timestamp: Date.now() })
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'workflow:node-status', runId: 'r1', nodeId: 'n1', status: 'running' }),
    )
  })

  it('delivers workflow:run-finished events to their listener', () => {
    const bus = createEventBus()
    const handler = vi.fn()
    bus.on('workflow:run-finished', handler)
    bus.emit({ type: 'workflow:run-finished', runId: 'r1', status: 'done', result: { ok: true }, timestamp: Date.now() })
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'workflow:run-finished', runId: 'r1', status: 'done' }),
    )
  })
})
