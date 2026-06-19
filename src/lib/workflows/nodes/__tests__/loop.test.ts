import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks ---------------------------------------------------------------
// Shared spies the class mock delegates to, so tests can assert/override per case.
const h = vi.hoisted(() => ({
  findById: vi.fn(),
  findAll: vi.fn(),
  runWorkflow: vi.fn(),
  normalizeGraph: vi.fn(),
}))

vi.mock('@/lib/storage', () => {
  // Class (not arrow) so `new WorkflowRepository(db)` works.
  class WorkflowRepository {
    findById = h.findById
    findAll = h.findAll
  }
  return {
    initDb: vi.fn(async () => ({})),
    WorkflowRepository,
  }
})

vi.mock('@/lib/workflows/engine', () => ({
  runWorkflow: h.runWorkflow,
}))

vi.mock('@/lib/workflows/graph', () => ({
  normalizeGraph: h.normalizeGraph,
}))

// The lazy `await import('@/lib/workflows/node-registry')` inside execute must resolve.
vi.mock('@/lib/workflows/node-registry', () => ({
  WORKFLOW_NODE_REGISTRY: new Map(),
}))

import { LoopNodeDef } from '@/lib/workflows/nodes/loop'

// --- Helpers -------------------------------------------------------------
const ctx = (inputs: Record<string, unknown>) => ({
  inputs,
  nodeId: 'n',
  runId: 'r',
  permissionScope: { allowedPaths: [], allowedDomains: [], shellEnabled: false },
  report: vi.fn(),
})

beforeEach(() => {
  vi.clearAllMocks()
  h.findById.mockResolvedValue({
    id: 'sub',
    name: 'Body',
    description: '',
    nodes: [],
    edges: [],
    createdAt: 0,
    updatedAt: 0,
  })
  h.findAll.mockResolvedValue([])
  h.normalizeGraph.mockReturnValue({ nodes: [], edges: [] })
  h.runWorkflow.mockResolvedValue({ status: 'done', output: { v: 1 }, nodeStates: {} })
})

// --- loop ----------------------------------------------------------------
describe('loop node', () => {
  it('has the locked identity, ports, and default config', () => {
    expect(LoopNodeDef.type).toBe('loop')
    expect(LoopNodeDef.category).toBe('control')
    expect(LoopNodeDef.label).toBe('Loop')
    expect(LoopNodeDef.icon).toBe('🔁')
    expect(LoopNodeDef.defaultConfig()).toEqual({ maxIterations: 100 })

    const ports = LoopNodeDef.ports({})
    expect(ports.inputs).toEqual([{ name: 'items', label: 'Items', type: 'json' }])
    expect(ports.outputs).toEqual([{ name: 'results', label: 'Results', type: 'json' }])
  })

  it('throws when no sub-workflow is selected', async () => {
    await expect(
      LoopNodeDef.execute!(ctx({ items: [1, 2] }) as never, {}),
    ).rejects.toThrow(/no sub-workflow/)
    expect(h.runWorkflow).not.toHaveBeenCalled()
  })

  it('runs the sub-workflow once per item and collects outputs', async () => {
    const out = await LoopNodeDef.execute!(ctx({ items: ['a', 'b'] }) as never, {
      subWorkflowId: 'sub',
    })

    expect(h.runWorkflow).toHaveBeenCalledTimes(2)
    expect(out).toEqual({ results: [{ v: 1 }, { v: 1 }] })
  })

  it('treats a non-array items input as empty and never runs the sub-workflow', async () => {
    const out = await LoopNodeDef.execute!(ctx({ items: 'nope' }) as never, {
      subWorkflowId: 'sub',
    })

    expect(out).toEqual({ results: [] })
    expect(h.runWorkflow).not.toHaveBeenCalled()
  })

  it('throws when the item count exceeds maxIterations', async () => {
    await expect(
      LoopNodeDef.execute!(ctx({ items: [1, 2] }) as never, {
        subWorkflowId: 'sub',
        maxIterations: 1,
      }),
    ).rejects.toThrow(/maxIterations/)
    expect(h.runWorkflow).not.toHaveBeenCalled()
  })
})
