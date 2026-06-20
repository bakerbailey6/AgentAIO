import { describe, it, expect, vi } from 'vitest'
import { ConditionalNodeDef, type ConditionalConfig } from '../conditional'
import type { WorkflowNodeContext } from '@/lib/interfaces'

/** Build a minimal {@link WorkflowNodeContext} for the given inputs. */
function ctx(inputs: Record<string, unknown>): WorkflowNodeContext {
  return {
    inputs,
    nodeId: 'n',
    runId: 'r',
    permissionScope: { allowedPaths: [], allowedDomains: [], shellEnabled: false },
    report: vi.fn(),
  }
}

describe('ConditionalNodeDef', () => {
  it('routes a truthy input to the true branch only', async () => {
    const config: ConditionalConfig = ConditionalNodeDef.defaultConfig()
    const out = await ConditionalNodeDef.execute!(ctx({ input: 'hello' }), config)
    expect(out).toEqual({ true: 'hello' })
    expect('false' in out).toBe(false)
  })

  it('routes a falsy input to the false branch only', async () => {
    const config: ConditionalConfig = ConditionalNodeDef.defaultConfig()
    const out = await ConditionalNodeDef.execute!(ctx({ input: 0 }), config)
    expect(out).toEqual({ false: 0 })
    expect('true' in out).toBe(false)
  })

  it('evaluates an eq predicate with a path', async () => {
    const config: ConditionalConfig = { path: 'x', op: 'eq', value: 5 }
    const input = { x: 5 }
    const out = await ConditionalNodeDef.execute!(ctx({ input }), config)
    expect(out).toEqual({ true: input })
    expect('false' in out).toBe(false)
  })

  it('defaults the operator to truthy', () => {
    expect(ConditionalNodeDef.defaultConfig().op).toBe('truthy')
  })

  it('exposes true and false output ports', () => {
    const ports = ConditionalNodeDef.ports(ConditionalNodeDef.defaultConfig())
    expect(ports.outputs.map((p) => p.name)).toEqual(['true', 'false'])
    expect(ports.inputs.map((p) => p.name)).toEqual(['input'])
  })
})
