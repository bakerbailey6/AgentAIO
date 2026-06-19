import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WorkflowNodeDef, PermissionScope } from '@/lib/interfaces'
import type { WorkflowGraph } from '@/lib/workflows/graph'

const emit = vi.fn()
vi.mock('@/lib/event-bus', () => ({ getEventBus: () => ({ emit }) }))

import { runWorkflow } from '@/lib/workflows/engine'

/** Build a fake node def whose `execute` runs `run` over the gathered inputs. */
function def(
  type: string,
  run: (inputs: Record<string, unknown>) => Record<string, unknown>,
): WorkflowNodeDef {
  return {
    type,
    category: 'compute',
    label: type,
    icon: '',
    ports: () => ({ inputs: [], outputs: [] }),
    defaultConfig: () => ({}),
    ConfigPanel: () => null,
    execute: async (ctx) => run(ctx.inputs),
  }
}

const SCOPE: PermissionScope = { allowedPaths: [], allowedDomains: [], shellEnabled: false }

beforeEach(() => {
  emit.mockClear()
})

describe('runWorkflow', () => {
  it('runs a linear graph and returns the output value', async () => {
    const registry = new Map<string, WorkflowNodeDef>([
      ['start', def('start', () => ({ value: 1 }))],
      ['inc', def('inc', (i) => ({ value: (i.input as number) + 1 }))],
      ['output', def('output', () => ({}))],
    ])
    const graph: WorkflowGraph = {
      nodes: [
        { id: 's', type: 'start', config: {} },
        { id: 'a', type: 'inc', config: {} },
        { id: 'o', type: 'output', config: {} },
      ],
      edges: [
        { id: 'e1', source: 's', sourcePort: 'value', target: 'a', targetPort: 'input' },
        { id: 'e2', source: 'a', sourcePort: 'value', target: 'o', targetPort: 'value' },
      ],
    }
    const res = await runWorkflow(graph, 0, { runId: 'r1', permissionScope: SCOPE, registry })
    expect(res.status).toBe('done')
    expect(res.output).toEqual({ value: 2 })
    expect(res.nodeStates.s.status).toBe('done')
    expect(res.nodeStates.a.status).toBe('done')
    expect(res.nodeStates.o.status).toBe('done')
  })

  it('seeds the start node with __runInput', async () => {
    const seen: Record<string, unknown> = {}
    const registry = new Map<string, WorkflowNodeDef>([
      ['start', def('start', (i) => {
        seen.runInput = i.__runInput
        return { value: i.__runInput }
      })],
      ['output', def('output', () => ({}))],
    ])
    const graph: WorkflowGraph = {
      nodes: [
        { id: 's', type: 'start', config: {} },
        { id: 'o', type: 'output', config: {} },
      ],
      edges: [{ id: 'e1', source: 's', sourcePort: 'value', target: 'o', targetPort: 'value' }],
    }
    const res = await runWorkflow(graph, { hello: 'world' }, {
      runId: 'r1',
      permissionScope: SCOPE,
      registry,
    })
    expect(seen.runInput).toEqual({ hello: 'world' })
    expect(res.output).toEqual({ value: { hello: 'world' } })
  })

  it('runs a diamond (parallel + join): both branches execute and join merges', async () => {
    const aExec = vi.fn((i: Record<string, unknown>) => ({ out: `A:${i.in}` }))
    const bExec = vi.fn((i: Record<string, unknown>) => ({ out: `B:${i.in}` }))
    const joinExec = vi.fn((i: Record<string, unknown>) => ({ merged: [i.a, i.b] }))

    const registry = new Map<string, WorkflowNodeDef>([
      ['start', def('start', () => ({ value: 'x' }))],
      ['A', def('A', aExec)],
      ['B', def('B', bExec)],
      ['join', def('join', joinExec)],
      ['output', def('output', () => ({}))],
    ])
    const graph: WorkflowGraph = {
      nodes: [
        { id: 's', type: 'start', config: {} },
        { id: 'a', type: 'A', config: {} },
        { id: 'b', type: 'B', config: {} },
        { id: 'j', type: 'join', config: {} },
        { id: 'o', type: 'output', config: {} },
      ],
      edges: [
        { id: 'e1', source: 's', sourcePort: 'value', target: 'a', targetPort: 'in' },
        { id: 'e2', source: 's', sourcePort: 'value', target: 'b', targetPort: 'in' },
        { id: 'e3', source: 'a', sourcePort: 'out', target: 'j', targetPort: 'a' },
        { id: 'e4', source: 'b', sourcePort: 'out', target: 'j', targetPort: 'b' },
        { id: 'e5', source: 'j', sourcePort: 'merged', target: 'o', targetPort: 'result' },
      ],
    }
    const res = await runWorkflow(graph, null, { runId: 'r1', permissionScope: SCOPE, registry })

    expect(aExec).toHaveBeenCalledTimes(1)
    expect(bExec).toHaveBeenCalledTimes(1)
    expect(joinExec).toHaveBeenCalledTimes(1)
    expect(res.status).toBe('done')
    expect(res.output).toEqual({ result: ['A:x', 'B:x'] })
  })

  it('marks a throwing node error and leaves its dependents not-run', async () => {
    const downstream = vi.fn(() => ({ value: 'should-not-run' }))
    const registry = new Map<string, WorkflowNodeDef>([
      ['start', def('start', () => ({ value: 1 }))],
      ['boom', def('boom', () => {
        throw new Error('kaboom')
      })],
      ['after', def('after', downstream)],
      ['output', def('output', () => ({}))],
    ])
    const graph: WorkflowGraph = {
      nodes: [
        { id: 's', type: 'start', config: {} },
        { id: 'x', type: 'boom', config: {} },
        { id: 'd', type: 'after', config: {} },
        { id: 'o', type: 'output', config: {} },
      ],
      edges: [
        { id: 'e1', source: 's', sourcePort: 'value', target: 'x', targetPort: 'in' },
        { id: 'e2', source: 'x', sourcePort: 'out', target: 'd', targetPort: 'in' },
        { id: 'e3', source: 'd', sourcePort: 'out', target: 'o', targetPort: 'value' },
      ],
    }
    const res = await runWorkflow(graph, 0, { runId: 'r1', permissionScope: SCOPE, registry })

    expect(res.status).toBe('error')
    expect(res.nodeStates.x.status).toBe('error')
    expect(res.nodeStates.x.error).toBe('kaboom')
    expect(res.nodeStates.d.status).toBe('pending')
    expect(downstream).not.toHaveBeenCalled()
    // The output node never gathered its inputs because its dependency stalled.
    expect(res.output).toBeNull()
  })

  it('returns empty output when the output node has no incoming edges', async () => {
    const registry = new Map<string, WorkflowNodeDef>([
      ['start', def('start', () => ({ value: 1 }))],
      ['output', def('output', () => ({}))],
    ])
    // Output node exists (validateGraph requires it) but nothing feeds it; it
    // runs as a root and gathers no inputs.
    const graph: WorkflowGraph = {
      nodes: [
        { id: 's', type: 'start', config: {} },
        { id: 'o', type: 'output', config: {} },
      ],
      edges: [],
    }
    const res = await runWorkflow(graph, 0, { runId: 'r1', permissionScope: SCOPE, registry })
    expect(res.status).toBe('done')
    expect(res.output).toEqual({})
    expect(res.nodeStates.o.status).toBe('done')
  })

  it('returns null output when the output node never runs (stalled dependency)', async () => {
    const registry = new Map<string, WorkflowNodeDef>([
      ['start', def('start', () => ({ value: 1 }))],
      ['boom', def('boom', () => {
        throw new Error('kaboom')
      })],
      ['output', def('output', () => ({}))],
    ])
    const graph: WorkflowGraph = {
      nodes: [
        { id: 's', type: 'start', config: {} },
        { id: 'x', type: 'boom', config: {} },
        { id: 'o', type: 'output', config: {} },
      ],
      edges: [
        { id: 'e1', source: 's', sourcePort: 'value', target: 'x', targetPort: 'in' },
        { id: 'e2', source: 'x', sourcePort: 'out', target: 'o', targetPort: 'value' },
      ],
    }
    const res = await runWorkflow(graph, 0, { runId: 'r1', permissionScope: SCOPE, registry })
    expect(res.status).toBe('error')
    expect(res.output).toBeNull()
    expect(res.nodeStates.o.status).toBe('pending')
  })

  it('emits run-started and run-finished around the run', async () => {
    const registry = new Map<string, WorkflowNodeDef>([
      ['start', def('start', () => ({ value: 1 }))],
      ['output', def('output', () => ({}))],
    ])
    const graph: WorkflowGraph = {
      nodes: [
        { id: 's', type: 'start', config: {} },
        { id: 'o', type: 'output', config: {} },
      ],
      edges: [{ id: 'e1', source: 's', sourcePort: 'value', target: 'o', targetPort: 'value' }],
    }
    await runWorkflow(graph, 0, { runId: 'r1', permissionScope: SCOPE, registry })

    const types = emit.mock.calls.map((c) => c[0].type)
    expect(types[0]).toBe('workflow:run-started')
    expect(types).toContain('workflow:node-status')
    expect(types[types.length - 1]).toBe('workflow:run-finished')

    const started = emit.mock.calls.find((c) => c[0].type === 'workflow:run-started')![0]
    expect(started.runId).toBe('r1')
    const finished = emit.mock.calls.find((c) => c[0].type === 'workflow:run-finished')![0]
    expect(finished.runId).toBe('r1')
    expect(finished.status).toBe('done')
  })

  it('emits node-status running then done for each executed node', async () => {
    const registry = new Map<string, WorkflowNodeDef>([
      ['start', def('start', () => ({ value: 1 }))],
      ['output', def('output', () => ({}))],
    ])
    const graph: WorkflowGraph = {
      nodes: [
        { id: 's', type: 'start', config: {} },
        { id: 'o', type: 'output', config: {} },
      ],
      edges: [{ id: 'e1', source: 's', sourcePort: 'value', target: 'o', targetPort: 'value' }],
    }
    await runWorkflow(graph, 0, { runId: 'r1', permissionScope: SCOPE, registry })

    const statuses = emit.mock.calls
      .map((c) => c[0])
      .filter((e) => e.type === 'workflow:node-status' && e.nodeId === 's')
      .map((e) => e.status)
    expect(statuses).toEqual(['running', 'done'])
  })

  it('forwards report() calls from a node to the bus as node-status', async () => {
    const registry = new Map<string, WorkflowNodeDef>([
      ['start', {
        type: 'start',
        category: 'io',
        label: 'start',
        icon: '',
        ports: () => ({ inputs: [], outputs: [] }),
        defaultConfig: () => ({}),
        ConfigPanel: () => null,
        execute: async (ctx) => {
          ctx.report('running', 'halfway')
          return { value: 1 }
        },
      } as WorkflowNodeDef],
      ['output', def('output', () => ({}))],
    ])
    const graph: WorkflowGraph = {
      nodes: [
        { id: 's', type: 'start', config: {} },
        { id: 'o', type: 'output', config: {} },
      ],
      edges: [{ id: 'e1', source: 's', sourcePort: 'value', target: 'o', targetPort: 'value' }],
    }
    await runWorkflow(graph, 0, { runId: 'r1', permissionScope: SCOPE, registry })

    const reported = emit.mock.calls
      .map((c) => c[0])
      .find((e) => e.type === 'workflow:node-status' && e.detail === 'halfway')
    expect(reported).toBeDefined()
    expect(reported.nodeId).toBe('s')
  })

  it('returns error (no node states) when the graph is invalid', async () => {
    const registry = new Map<string, WorkflowNodeDef>([
      ['start', def('start', () => ({ value: 1 }))],
      ['output', def('output', () => ({}))],
    ])
    // Two start nodes -> validateGraph throws.
    const graph: WorkflowGraph = {
      nodes: [
        { id: 's1', type: 'start', config: {} },
        { id: 's2', type: 'start', config: {} },
        { id: 'o', type: 'output', config: {} },
      ],
      edges: [],
    }
    const res = await runWorkflow(graph, 0, { runId: 'r1', permissionScope: SCOPE, registry })
    expect(res.status).toBe('error')
    expect(res.output).toBeNull()
    expect(res.nodeStates).toEqual({})
    const finished = emit.mock.calls.find((c) => c[0].type === 'workflow:run-finished')
    expect(finished![0].status).toBe('error')
  })

  it('errors a node whose type is missing from the registry', async () => {
    const registry = new Map<string, WorkflowNodeDef>([
      ['start', def('start', () => ({ value: 1 }))],
      ['output', def('output', () => ({}))],
    ])
    const graph: WorkflowGraph = {
      nodes: [
        { id: 's', type: 'start', config: {} },
        { id: 'm', type: 'mystery', config: {} },
        { id: 'o', type: 'output', config: {} },
      ],
      edges: [
        { id: 'e1', source: 's', sourcePort: 'value', target: 'm', targetPort: 'in' },
        { id: 'e2', source: 'm', sourcePort: 'out', target: 'o', targetPort: 'value' },
      ],
    }
    const res = await runWorkflow(graph, 0, { runId: 'r1', permissionScope: SCOPE, registry })
    expect(res.status).toBe('error')
    expect(res.nodeStates.m.status).toBe('error')
    expect(res.nodeStates.o.status).toBe('pending')
  })
})
