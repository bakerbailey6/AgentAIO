import { vi } from 'vitest'
import type { CanvasNode } from '@/lib/interfaces'

// AgentCardNode (pulled in transitively) imports reactflow and the agent
// registry; stub both so importing the registry stays light and Tauri-free.
vi.mock('reactflow', () => ({
  Handle: () => null,
  Position: { Left: 'left', Right: 'right' },
}))
vi.mock('@/lib/agents/registry', () => ({
  AGENT_REGISTRY: new Map(),
  registerAgent: vi.fn(),
}))

import { NODE_REGISTRY, getNodeTypes, registerCanvasNode } from '../node-registry'
import { AgentCardNodeDef } from '@/components/canvas/AgentCardNode'
import { GroupNodeDef } from '@/components/canvas/GroupNode'

describe('node-registry', () => {
  it('registers the built-in agentCard node type', () => {
    expect(NODE_REGISTRY.get('agentCard')).toBe(AgentCardNodeDef)
  })

  it('registers the built-in group node type', () => {
    expect(NODE_REGISTRY.get('group')).toBe(GroupNodeDef)
  })

  it('getNodeTypes maps each registered key to its component', () => {
    const types = getNodeTypes()
    expect(types.agentCard).toBe(AgentCardNodeDef.CardComponent)
    expect(types.group).toBe(GroupNodeDef.CardComponent)
  })

  it('registerCanvasNode adds a new node type that getNodeTypes exposes', () => {
    const Dummy = () => null
    const customDef = {
      nodeType: 'custom-test-node',
      defaultData: () => ({ label: 'x' }),
      CardComponent: Dummy,
    } as unknown as CanvasNode

    registerCanvasNode(customDef)

    expect(NODE_REGISTRY.get('custom-test-node')).toBe(customDef)
    expect(getNodeTypes()['custom-test-node']).toBe(Dummy)

    // keep the shared module-level registry clean for other tests
    NODE_REGISTRY.delete('custom-test-node')
  })
})
