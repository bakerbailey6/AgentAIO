import { describe, it, expect } from 'vitest'
import {
  WORKFLOW_NODE_REGISTRY,
  listWorkflowNodes,
  registerWorkflowNode,
} from '@/lib/workflows/node-registry'
import type { WorkflowNodeDef } from '@/lib/interfaces'

// NOTE: this key assertion is intentionally exhaustive — register a new built-in
// workflow node and you must update this array (mirrors the provider/agent/tool
// registry tests).
const KEYS = ['agent', 'conditional', 'join', 'loop', 'output', 'start', 'tool', 'transform']

describe('WORKFLOW_NODE_REGISTRY', () => {
  it('is a Map keyed by the built-in node types (exhaustive — update when adding one)', () => {
    expect(WORKFLOW_NODE_REGISTRY).toBeInstanceOf(Map)
    expect([...WORKFLOW_NODE_REGISTRY.keys()].sort()).toEqual(KEYS)
  })

  it('every def matches its key and declares ports/config/panel', () => {
    for (const [key, def] of WORKFLOW_NODE_REGISTRY) {
      expect(def.type).toBe(key)
      expect(typeof def.defaultConfig).toBe('function')
      expect(typeof def.ConfigPanel).toBe('function')
      expect(def.ports(def.defaultConfig())).toHaveProperty('inputs')
    }
  })

  it('listWorkflowNodes returns all defs', () => {
    expect(listWorkflowNodes().map((d) => d.type).sort()).toEqual(KEYS)
  })

  it('registerWorkflowNode adds then replaces a def keyed by its type', () => {
    const fake = {
      type: 'fake-test',
      category: 'compute',
      label: 'Fake',
      icon: '',
      ports: () => ({ inputs: [], outputs: [] }),
      defaultConfig: () => ({}),
      ConfigPanel: () => null,
    } as unknown as WorkflowNodeDef
    try {
      registerWorkflowNode(fake)
      expect(WORKFLOW_NODE_REGISTRY.get('fake-test')).toBe(fake)
      const replacement = { ...fake, label: 'Fake 2' } as unknown as WorkflowNodeDef
      registerWorkflowNode(replacement)
      expect(WORKFLOW_NODE_REGISTRY.get('fake-test')).toBe(replacement)
    } finally {
      WORKFLOW_NODE_REGISTRY.delete('fake-test')
    }
    expect([...WORKFLOW_NODE_REGISTRY.keys()].sort()).toEqual(KEYS)
  })
})
