import { describe, it, expect } from 'vitest'
import { normalizeGraph, validateGraph } from '@/lib/workflows/graph'
import type { WorkflowNode, WorkflowEdge } from '@/lib/workflows/graph'

const g = (nodes: WorkflowNode[], edges: WorkflowEdge[] = []) => ({ nodes, edges })

describe('workflow graph', () => {
  it('normalizes RF rows into typed graph', () => {
    const out = normalizeGraph(
      [{ id: 'a', data: { type: 'start', config: {} } }],
      [{ id: 'e', source: 'a', target: 'b', sourceHandle: 'out', targetHandle: 'in' }],
    )
    expect(out.nodes[0]).toEqual({ id: 'a', type: 'start', config: {} })
    expect(out.edges[0]).toEqual({ id: 'e', source: 'a', sourcePort: 'out', target: 'b', targetPort: 'in' })
  })

  it('defaults a missing node config to {} and null handles to empty strings', () => {
    const out = normalizeGraph(
      [{ id: 'a', data: { type: 'output' } }],
      [{ id: 'e', source: 'a', target: 'b', sourceHandle: null, targetHandle: undefined }],
    )
    expect(out.nodes[0]).toEqual({ id: 'a', type: 'output', config: {} })
    expect(out.edges[0]).toEqual({ id: 'e', source: 'a', sourcePort: '', target: 'b', targetPort: '' })
  })

  it('requires exactly one start', () => {
    expect(() => validateGraph(g([{ id: 'o', type: 'output', config: {} }]))).toThrow(/exactly one start/i)
  })

  it('rejects multiple starts', () => {
    const graph = g([
      { id: 's1', type: 'start', config: {} },
      { id: 's2', type: 'start', config: {} },
      { id: 'o', type: 'output', config: {} },
    ])
    expect(() => validateGraph(graph)).toThrow(/exactly one start/i)
  })

  it('requires at least one output', () => {
    expect(() => validateGraph(g([{ id: 's', type: 'start', config: {} }]))).toThrow(/output/i)
  })

  it('rejects an edge referencing a missing node', () => {
    const graph = g(
      [{ id: 's', type: 'start', config: {} }, { id: 'o', type: 'output', config: {} }],
      [{ id: 'e1', source: 's', sourcePort: 'out', target: 'ghost', targetPort: 'in' }],
    )
    expect(() => validateGraph(graph)).toThrow()
  })

  it('rejects a cycle', () => {
    const graph = g(
      [{ id: 's', type: 'start', config: {} }, { id: 'o', type: 'output', config: {} }],
      [
        { id: 'e1', source: 's', sourcePort: 'o', target: 'o', targetPort: 'i' },
        { id: 'e2', source: 'o', sourcePort: 'o', target: 's', targetPort: 'i' },
      ],
    )
    expect(() => validateGraph(graph)).toThrow(/cycle/i)
  })

  it('accepts a valid linear graph', () => {
    const graph = g(
      [{ id: 's', type: 'start', config: {} }, { id: 'o', type: 'output', config: {} }],
      [{ id: 'e1', source: 's', sourcePort: 'out', target: 'o', targetPort: 'in' }],
    )
    expect(() => validateGraph(graph)).not.toThrow()
  })
})
