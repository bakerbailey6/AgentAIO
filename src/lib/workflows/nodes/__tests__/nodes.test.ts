import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AgentEvent } from '@/lib/interfaces'

// --- Mocks ---------------------------------------------------------------
// Shared spies the class mocks delegate to, so tests can assert/override per case.
const h = vi.hoisted(() => ({
  findById: vi.fn(),
  findAll: vi.fn(),
  createSession: vi.fn(),
  providerRun: vi.fn(),
  resolveRuntimeType: vi.fn((t: string) => t),
  agentRegistry: new Map<string, unknown>(),
  toolRegistry: new Map<string, unknown>(),
}))

vi.mock('@/lib/storage', () => {
  // Classes (not arrows) so `new XRepository(db)` works.
  class AgentRepository {
    findById = h.findById
    findAll = h.findAll
  }
  class SessionRepository {
    create = h.createSession
  }
  return {
    initDb: vi.fn(async () => ({})),
    AgentRepository,
    SessionRepository,
  }
})

vi.mock('@/lib/agents/registry', () => ({
  AGENT_REGISTRY: h.agentRegistry,
  resolveAgentRuntimeType: h.resolveRuntimeType,
}))

vi.mock('@/lib/tools/registry', () => ({
  TOOL_REGISTRY: h.toolRegistry,
  listBuiltInTools: () => [...h.toolRegistry.values()],
}))

import { StartNodeDef } from '@/lib/workflows/nodes/start'
import { OutputNodeDef } from '@/lib/workflows/nodes/output'
import { JoinNodeDef } from '@/lib/workflows/nodes/join'
import { AgentNodeDef } from '@/lib/workflows/nodes/agent'
import { ToolNodeDef } from '@/lib/workflows/nodes/tool'

// --- Helpers -------------------------------------------------------------
const ctx = (inputs: Record<string, unknown>) => ({
  inputs,
  nodeId: 'n',
  runId: 'r',
  permissionScope: { allowedPaths: [], allowedDomains: [], shellEnabled: false },
  report: vi.fn(),
})

function delta(text: string): AgentEvent {
  return { type: 'text-delta', agentId: 'a', timestamp: 0, payload: { delta: text } }
}

beforeEach(() => {
  vi.clearAllMocks()
  h.agentRegistry.clear()
  h.toolRegistry.clear()
  h.resolveRuntimeType.mockImplementation((t: string) => t)
})

// --- start ---------------------------------------------------------------
describe('start node', () => {
  it('emits the injected run input on its value port', async () => {
    const out = await StartNodeDef.execute!(ctx({ __runInput: 42 }) as never, {})
    expect(out).toEqual({ value: 42 })
  })

  it('has no inputs and a single value output', () => {
    const ports = StartNodeDef.ports({})
    expect(ports.inputs).toEqual([])
    expect(ports.outputs).toEqual([{ name: 'value', label: 'Value', type: 'any' }])
  })
})

// --- output --------------------------------------------------------------
describe('output node', () => {
  it('returns an empty object (engine reads its inputs as the result)', async () => {
    const out = await OutputNodeDef.execute!(ctx({ value: 'x' }) as never, {})
    expect(out).toEqual({})
  })

  it('has a single value input and no outputs', () => {
    const ports = OutputNodeDef.ports({})
    expect(ports.inputs).toEqual([{ name: 'value', label: 'Value', type: 'any' }])
    expect(ports.outputs).toEqual([])
  })
})

// --- join ----------------------------------------------------------------
describe('join node', () => {
  it('exposes N inputs from config.count', () => {
    const ports = JoinNodeDef.ports({ count: 3 })
    expect(ports.inputs).toHaveLength(3)
    expect(ports.inputs.map((p) => p.name)).toEqual(['in1', 'in2', 'in3'])
    expect(ports.outputs).toEqual([{ name: 'value', label: 'Value', type: 'json' }])
  })

  it('defaults to a count of 2', () => {
    expect(JoinNodeDef.defaultConfig()).toEqual({ count: 2 })
  })

  it('merges all inputs into one object on its value port', async () => {
    const out = await JoinNodeDef.execute!(ctx({ in1: 'a', in2: 'b' }) as never, { count: 2 })
    expect(out).toEqual({ value: { in1: 'a', in2: 'b' } })
  })
})

// --- agent ---------------------------------------------------------------
describe('agent node', () => {
  it('throws when no agent is selected', async () => {
    await expect(
      AgentNodeDef.execute!(ctx({ input: 'hi' }) as never, { promptTemplate: '{{input}}' }),
    ).rejects.toThrow('agent node has no agent selected')
  })

  it('accumulates text-deltas and returns text + result', async () => {
    h.findById.mockResolvedValue({ id: 'a1', type: 'llm' })
    h.createSession.mockResolvedValue('sess-1')
    h.providerRun.mockImplementation(async function* () {
      yield delta('A')
      yield delta('B')
    })
    h.agentRegistry.set('llm', { run: h.providerRun })

    const c = ctx({ input: 'world' })
    const out = await AgentNodeDef.execute!(c as never, {
      agentId: 'a1',
      promptTemplate: 'say {{input}}',
    })

    expect(out).toEqual({ text: 'AB', result: 'AB' })
    // Session created for the configured agent.
    expect(h.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: 'a1', messages: [] }),
    )
    // Prompt template substituted and provider run with the new session.
    expect(h.providerRun).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sess-1', agentId: 'a1' }),
      'say world',
    )
    // Status reported around the run.
    expect(c.report).toHaveBeenCalledWith('running')
    expect(c.report).toHaveBeenCalledWith('done')
  })

  it('resolves the runtime type before looking up the provider', async () => {
    h.findById.mockResolvedValue({ id: 'a2', type: 'coding-agent' })
    h.createSession.mockResolvedValue('sess-2')
    h.resolveRuntimeType.mockReturnValue('claude-code')
    h.providerRun.mockImplementation(async function* () {
      yield delta('X')
    })
    h.agentRegistry.set('claude-code', { run: h.providerRun })

    const out = await AgentNodeDef.execute!(ctx({ input: '' }) as never, {
      agentId: 'a2',
      promptTemplate: '{{input}}',
    })
    expect(h.resolveRuntimeType).toHaveBeenCalledWith('coding-agent')
    expect(out).toEqual({ text: 'X', result: 'X' })
  })
})

// --- tool ----------------------------------------------------------------
describe('tool node', () => {
  it('throws when no tool is selected', async () => {
    await expect(
      ToolNodeDef.execute!(ctx({ input: 'x' }) as never, { argsTemplate: '{}' }),
    ).rejects.toThrow('tool node has no tool selected')
  })

  it('parses argsTemplate, calls def.execute, and returns the result', async () => {
    const execute = vi.fn().mockResolvedValue({ ok: true })
    h.toolRegistry.set('file_read', { name: 'file_read', execute })

    const out = await ToolNodeDef.execute!(ctx({ input: 'README.md' }) as never, {
      toolName: 'file_read',
      argsTemplate: '{"path": "{{input}}"}',
    })

    expect(execute).toHaveBeenCalledWith(
      { path: 'README.md' },
      expect.objectContaining({ agentId: 'workflow', sessionId: 'r' }),
    )
    expect(out).toEqual({ result: { ok: true } })
  })

  it('throws when the configured tool is unknown', async () => {
    await expect(
      ToolNodeDef.execute!(ctx({ input: 'x' }) as never, {
        toolName: 'nope',
        argsTemplate: '{}',
      }),
    ).rejects.toThrow('unknown tool nope')
  })
})
