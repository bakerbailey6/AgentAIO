import { describe, it, expect, vi } from 'vitest'
import { TransformNodeDef } from '@/lib/workflows/nodes/transform'

// --- Helpers -------------------------------------------------------------
const ctx = (inputs: Record<string, unknown>) => ({
  inputs,
  nodeId: 'n',
  runId: 'r',
  permissionScope: { allowedPaths: [], allowedDomains: [], shellEnabled: false },
  report: vi.fn(),
})

// --- transform -----------------------------------------------------------
describe('transform node', () => {
  it('plucks a field via a {{input.field}} template', async () => {
    const out = await TransformNodeDef.execute!(
      ctx({ input: { name: 'Ada' } }) as never,
      { template: '{{input.name}}' },
    )
    expect(out).toEqual({ output: 'Ada' })
  })

  it('parses a JSON template into a value', async () => {
    const out = await TransformNodeDef.execute!(ctx({ input: 5 }) as never, {
      template: '{"n": {{input}}}',
    })
    expect(out).toEqual({ output: { n: 5 } })
  })

  it('returns the raw string for a non-JSON template', async () => {
    const out = await TransformNodeDef.execute!(
      ctx({ input: 'world' }) as never,
      { template: 'hello {{input}}' },
    )
    expect(out).toEqual({ output: 'hello world' })
  })

  it('defaults to the {{input}} template', () => {
    expect(TransformNodeDef.defaultConfig().template).toBe('{{input}}')
  })
})
