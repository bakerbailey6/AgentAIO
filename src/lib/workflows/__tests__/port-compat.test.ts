import { describe, it, expect } from 'vitest'
import type { WorkflowNodeDef } from '@/lib/interfaces'
import {
  arePortTypesCompatible,
  connectionPortTypes,
  isConnectionCompatible,
  type EditorNodeLike,
} from '../port-compat'

/** A fake def: outputs one `text` port `out`, inputs one `json` port `in`. */
const fakeDef = {
  type: 'x',
  ports: () => ({
    inputs: [{ name: 'in', label: '', type: 'json' as const }],
    outputs: [{ name: 'out', label: '', type: 'text' as const }],
  }),
} as unknown as WorkflowNodeDef

/** A fake def whose only output port is `any`. */
const anyOutDef = {
  type: 'y',
  ports: () => ({
    inputs: [{ name: 'in', label: '', type: 'json' as const }],
    outputs: [{ name: 'out', label: '', type: 'any' as const }],
  }),
} as unknown as WorkflowNodeDef

const registry = new Map<string, WorkflowNodeDef>([
  ['x', fakeDef],
  ['y', anyOutDef],
])

const nodes: EditorNodeLike[] = [
  { id: 'a', data: { type: 'x', config: {} } },
  { id: 'b', data: { type: 'x', config: {} } },
]

describe('arePortTypesCompatible', () => {
  it('treats `any` source as compatible with anything', () => {
    expect(arePortTypesCompatible('any', 'text')).toBe(true)
    expect(arePortTypesCompatible('any', 'json')).toBe(true)
  })

  it('treats `any` target as compatible with anything', () => {
    expect(arePortTypesCompatible('text', 'any')).toBe(true)
    expect(arePortTypesCompatible('json', 'any')).toBe(true)
  })

  it('treats equal types as compatible', () => {
    expect(arePortTypesCompatible('text', 'text')).toBe(true)
    expect(arePortTypesCompatible('json', 'json')).toBe(true)
  })

  it('treats distinct concrete types as incompatible', () => {
    expect(arePortTypesCompatible('text', 'json')).toBe(false)
    expect(arePortTypesCompatible('json', 'text')).toBe(false)
  })
})

describe('connectionPortTypes', () => {
  it('resolves source-output and target-input port types', () => {
    const result = connectionPortTypes(nodes, registry, {
      source: 'a',
      sourceHandle: 'out',
      target: 'b',
      targetHandle: 'in',
    })
    expect(result).toEqual({ source: 'text', target: 'json' })
  })

  it('returns undefined for an unknown source node', () => {
    const result = connectionPortTypes(nodes, registry, {
      source: 'missing',
      sourceHandle: 'out',
      target: 'b',
      targetHandle: 'in',
    })
    expect(result.source).toBeUndefined()
    expect(result.target).toBe('json')
  })

  it('returns undefined when a handle name does not resolve', () => {
    const result = connectionPortTypes(nodes, registry, {
      source: 'a',
      sourceHandle: 'nope',
      target: 'b',
      targetHandle: 'in',
    })
    expect(result.source).toBeUndefined()
    expect(result.target).toBe('json')
  })

  it('returns undefined when the registry has no def for the node type', () => {
    const orphan: EditorNodeLike[] = [{ id: 'a', data: { type: 'unknown', config: {} } }]
    const result = connectionPortTypes(orphan, registry, {
      source: 'a',
      sourceHandle: 'out',
      target: 'a',
      targetHandle: 'in',
    })
    expect(result.source).toBeUndefined()
    expect(result.target).toBeUndefined()
  })
})

describe('isConnectionCompatible', () => {
  it('is false for an incompatible text→json wiring', () => {
    expect(
      isConnectionCompatible(nodes, registry, {
        source: 'a',
        sourceHandle: 'out',
        target: 'b',
        targetHandle: 'in',
      }),
    ).toBe(false)
  })

  it('is true when the source port is `any`', () => {
    const anyNodes: EditorNodeLike[] = [
      { id: 'a', data: { type: 'y', config: {} } },
      { id: 'b', data: { type: 'x', config: {} } },
    ]
    expect(
      isConnectionCompatible(anyNodes, registry, {
        source: 'a',
        sourceHandle: 'out',
        target: 'b',
        targetHandle: 'in',
      }),
    ).toBe(true)
  })

  it('is lenient (true) when a handle does not resolve', () => {
    expect(
      isConnectionCompatible(nodes, registry, {
        source: 'a',
        sourceHandle: 'nope',
        target: 'b',
        targetHandle: 'in',
      }),
    ).toBe(true)
  })

  it('is lenient (true) when the source node is missing', () => {
    expect(
      isConnectionCompatible(nodes, registry, {
        source: 'missing',
        sourceHandle: 'out',
        target: 'b',
        targetHandle: 'in',
      }),
    ).toBe(true)
  })
})
