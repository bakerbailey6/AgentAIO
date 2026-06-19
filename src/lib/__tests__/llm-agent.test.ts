import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AgentEvent, AgentSession } from '@/lib/interfaces'

const {
  streamTextMock,
  stepCountIsMock,
  agentFindById,
  sessionFindById,
  getAdapterMock,
  resolveCapsMock,
  toAiToolMock,
  toAiMcpToolMock,
  mcpToolKeyMock,
  mcpConnect,
  mcpListTools,
  mcpCallTool,
  resolveApprovalMock,
  abortMock,
} = vi.hoisted(() => ({
  streamTextMock: vi.fn(),
  stepCountIsMock: vi.fn(() => 'stop-when'),
  agentFindById: vi.fn(),
  sessionFindById: vi.fn(),
  getAdapterMock: vi.fn(),
  resolveCapsMock: vi.fn(),
  toAiToolMock: vi.fn((def: { name: string }, _ctx?: unknown) => ({ __tool: def.name })),
  toAiMcpToolMock: vi.fn(
    (serverId: string, toolName: string, _description: string, _call: (a: unknown) => Promise<unknown>) => ({
      __mcpTool: `${serverId}:${toolName}`,
    }),
  ),
  mcpToolKeyMock: vi.fn((serverId: string, toolName: string) => `mcp__${serverId}__${toolName}`),
  mcpConnect: vi.fn(async () => {}),
  mcpListTools: vi.fn(async () => [] as Array<{ name: string; description?: string }>),
  mcpCallTool: vi.fn(async () => ({})),
  resolveApprovalMock: vi.fn(),
  abortMock: vi.fn(),
}))

vi.mock('ai', () => ({ streamText: streamTextMock, stepCountIs: stepCountIsMock }))
vi.mock('@/lib/llm/router', () => ({
  LLMRouter: vi.fn().mockImplementation(function () { return { getAdapter: getAdapterMock } }),
}))
vi.mock('@/lib/storage', () => ({
  initDb: vi.fn(async () => ({})),
  AgentRepository: vi.fn().mockImplementation(function () { return { findById: agentFindById } }),
  SessionRepository: vi.fn().mockImplementation(function () { return { findById: sessionFindById } }),
}))
vi.mock('@/lib/agents/capabilities', () => ({ resolveCapabilities: resolveCapsMock }))
vi.mock('@/lib/agents/tool-adapter', () => ({
  toAiTool: toAiToolMock,
  toAiMcpTool: toAiMcpToolMock,
  mcpToolKey: mcpToolKeyMock,
}))
vi.mock('@/lib/agents/approval-gate', () => ({
  resolveApproval: resolveApprovalMock,
  abortSessionApprovals: abortMock,
}))
vi.mock('@/lib/mcp/registry', () => ({
  getMCPRegistry: () => ({ connect: mcpConnect, listTools: mcpListTools, callTool: mcpCallTool }),
}))

import { LLMAgentProvider } from '@/lib/agents/llm-agent'

/** Build a fake `streamText` result whose `fullStream` yields the given parts. */
function fakeResult(parts: unknown[]) {
  return {
    fullStream: (async function* () {
      for (const p of parts) yield p
    })(),
  }
}

async function collect(iterable: AsyncIterable<AgentEvent>): Promise<AgentEvent[]> {
  const out: AgentEvent[] = []
  for await (const e of iterable) out.push(e)
  return out
}

const session: AgentSession = {
  id: 's1',
  agentId: 'a1',
  permissionScope: { allowedPaths: [], allowedDomains: [], shellEnabled: false },
}

describe('LLMAgentProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    agentFindById.mockResolvedValue({
      id: 'a1', name: 'Bot', type: 'llm', modelId: 'model-1',
      systemPrompt: 'You are helpful.', toolIds: [], mcpIds: [],
      canvasX: 0, canvasY: 0, groupId: null, createdAt: 0,
    })
    sessionFindById.mockResolvedValue({
      id: 's1', agentId: 'a1',
      messages: [
        { id: 'm1', role: 'user', content: 'prior question', timestamp: 1 },
        { id: 'm2', role: 'assistant', content: 'prior answer', timestamp: 2 },
      ],
      tokenCount: 0, costEstimate: 0, createdAt: 0,
    })
    getAdapterMock.mockResolvedValue({ fakeModel: true })
    resolveCapsMock.mockResolvedValue({
      tools: new Map(),
      skillBodies: [],
      mcpServerIds: [],
      warnings: [],
    })
    mcpConnect.mockResolvedValue(undefined)
    mcpListTools.mockResolvedValue([])
  })

  it('implements AgentProvider interface', () => {
    const provider = new LLMAgentProvider()
    expect(provider.type).toBe('llm')
    expect(typeof provider.run).toBe('function')
    expect(typeof provider.stop).toBe('function')
    expect(typeof provider.approve).toBe('function')
    expect(typeof provider.deny).toBe('function')
    expect(typeof provider.getCapabilities).toBe('function')
  })

  it('getCapabilities returns expected values', () => {
    const caps = new LLMAgentProvider().getCapabilities()
    expect(caps.supportsTools).toBe(true)
    expect(caps.supportsStreaming).toBe(true)
    expect(caps.requiresProjectDirectory).toBe(false)
  })

  it('streams text deltas and ends idle on success', async () => {
    streamTextMock.mockReturnValue(
      fakeResult([
        { type: 'text-delta', text: 'Hel' },
        { type: 'text-delta', text: 'lo' },
      ]),
    )
    const events = await collect(new LLMAgentProvider().run(session, 'hi'))
    const deltas = events.filter((e) => e.type === 'text-delta').map((e) => (e.payload as { delta: string }).delta)
    expect(deltas).toEqual(['Hel', 'lo'])
    const statuses = events.filter((e) => e.type === 'status-change').map((e) => (e.payload as { status: string }).status)
    expect(statuses).toEqual(['running', 'idle'])
  })

  it('passes the system prompt and prior conversation history to the model', async () => {
    streamTextMock.mockReturnValue(fakeResult([{ type: 'text-delta', text: 'ok' }]))
    await collect(new LLMAgentProvider().run(session, 'new question'))

    expect(streamTextMock).toHaveBeenCalledTimes(1)
    const arg = streamTextMock.mock.calls[0][0] as { system?: string; messages: Array<{ role: string; content: string }> }
    expect(arg.system).toBe('You are helpful.')
    expect(arg.messages).toEqual([
      { role: 'user', content: 'prior question' },
      { role: 'assistant', content: 'prior answer' },
      { role: 'user', content: 'new question' },
    ])
  })

  it('surfaces stream errors instead of swallowing them', async () => {
    streamTextMock.mockReturnValue(fakeResult([{ type: 'error', error: new Error('bad key') }]))
    const events = await collect(new LLMAgentProvider().run(session, 'hi'))

    const error = events.find((e) => e.type === 'error')
    expect(error).toBeDefined()
    expect((error!.payload as { message: string }).message).toBe('bad key')
    const statuses = events.filter((e) => e.type === 'status-change').map((e) => (e.payload as { status: string }).status)
    expect(statuses).toEqual(['running', 'error'])
    expect(statuses).not.toContain('idle')
  })

  it('surfaces a thrown error (e.g. agent has no model) as an error event', async () => {
    agentFindById.mockResolvedValueOnce({
      id: 'a1', name: 'Bot', type: 'llm', modelId: null,
      systemPrompt: '', toolIds: [], mcpIds: [], canvasX: 0, canvasY: 0, groupId: null, createdAt: 0,
    })
    const events = await collect(new LLMAgentProvider().run(session, 'hi'))
    const error = events.find((e) => e.type === 'error')
    expect(error).toBeDefined()
    expect((error!.payload as { message: string }).message).toMatch(/no modelId/i)
    expect(streamTextMock).not.toHaveBeenCalled()
  })

  it('injects resolved skill bodies into the system prompt', async () => {
    resolveCapsMock.mockResolvedValue({
      tools: new Map(),
      skillBodies: ['SKILL BODY'],
      mcpServerIds: [],
      warnings: [],
    })
    streamTextMock.mockReturnValue(fakeResult([{ type: 'text-delta', text: 'ok' }]))
    await collect(new LLMAgentProvider().run(session, 'hi'))

    const arg = streamTextMock.mock.calls[0][0] as { system?: string }
    expect(arg.system).toContain('You are helpful.')
    expect(arg.system).toContain('SKILL BODY')
    expect(arg.system).toBe('You are helpful.\n\nSKILL BODY')
  })

  it('exposes resolved tools (with stopWhen) to streamText and adapts each one', async () => {
    const echoDef = { name: 'echo' }
    const addDef = { name: 'add' }
    resolveCapsMock.mockResolvedValue({
      tools: new Map<string, { name: string }>([
        ['echo', echoDef],
        ['add', addDef],
      ]),
      skillBodies: [],
      mcpServerIds: [],
      warnings: [],
    })
    streamTextMock.mockReturnValue(fakeResult([{ type: 'text-delta', text: 'ok' }]))
    await collect(new LLMAgentProvider().run(session, 'hi'))

    const arg = streamTextMock.mock.calls[0][0] as { tools?: Record<string, unknown>; stopWhen?: unknown }
    expect(arg.tools).toBeDefined()
    expect(Object.keys(arg.tools!).sort()).toEqual(['add', 'echo'])
    expect(arg.stopWhen).toBeTruthy()
    expect(stepCountIsMock).toHaveBeenCalled()
    expect(toAiToolMock).toHaveBeenCalledTimes(2)
    // The adapter receives the run context so tools can enforce permissions.
    const ctx = toAiToolMock.mock.calls[0][1] as unknown as {
      agentId: string
      sessionId: string
      permissionScope: unknown
    }
    expect(ctx).toMatchObject({ agentId: 'a1', sessionId: 's1', permissionScope: session.permissionScope })
  })

  it('passes no tools/stopWhen when there are no resolved tools', async () => {
    streamTextMock.mockReturnValue(fakeResult([{ type: 'text-delta', text: 'ok' }]))
    await collect(new LLMAgentProvider().run(session, 'hi'))

    const arg = streamTextMock.mock.calls[0][0] as { tools?: unknown; stopWhen?: unknown }
    expect(arg.tools).toBeUndefined()
    expect(arg.stopWhen).toBeUndefined()
    expect(toAiToolMock).not.toHaveBeenCalled()
  })

  it('translates tool-call / tool-result / tool-error stream parts into AgentEvents', async () => {
    streamTextMock.mockReturnValue(
      fakeResult([
        { type: 'tool-call', toolCallId: 'c1', toolName: 'echo', input: { msg: 'hi' } },
        { type: 'tool-result', toolCallId: 'c1', toolName: 'echo', output: { echoed: 'hi' } },
        { type: 'tool-error', toolCallId: 'c2', toolName: 'add', error: new Error('boom') },
        { type: 'text-delta', text: 'done' },
      ]),
    )
    const events = await collect(new LLMAgentProvider().run(session, 'hi'))

    const types = events.map((e) => e.type)
    // running, tool-call, tool-result, tool-result(error), text-delta, idle
    expect(types).toEqual([
      'status-change',
      'tool-call',
      'tool-result',
      'tool-result',
      'text-delta',
      'status-change',
    ])

    const toolCall = events.find((e) => e.type === 'tool-call')!
    expect(toolCall.payload).toEqual({ toolCallId: 'c1', toolName: 'echo', input: { msg: 'hi' } })

    const toolResults = events.filter((e) => e.type === 'tool-result')
    expect(toolResults[0].payload).toEqual({ toolCallId: 'c1', toolName: 'echo', output: { echoed: 'hi' } })
    expect(toolResults[1].payload).toEqual({
      toolCallId: 'c2',
      toolName: 'add',
      error: 'boom',
      isError: true,
    })

    // Tool parts do not end the run — it still finishes idle.
    const statuses = events
      .filter((e) => e.type === 'status-change')
      .map((e) => (e.payload as { status: string }).status)
    expect(statuses).toEqual(['running', 'idle'])
  })

  it('delegates approve/deny/stop to the shared approval gate', async () => {
    const provider = new LLMAgentProvider()
    await provider.approve('r1')
    expect(resolveApprovalMock).toHaveBeenCalledWith('r1', true)

    await provider.deny('r2')
    expect(resolveApprovalMock).toHaveBeenCalledWith('r2', false)

    await provider.stop('s1')
    expect(abortMock).toHaveBeenCalledWith('s1')
  })

  it('connects assigned MCP servers and exposes their tools (namespaced)', async () => {
    resolveCapsMock.mockResolvedValue({
      tools: new Map(),
      skillBodies: [],
      mcpServerIds: ['srv1'],
      warnings: [],
    })
    mcpListTools.mockResolvedValue([{ name: 'read_file', description: 'Read a file' }])
    streamTextMock.mockReturnValue(fakeResult([{ type: 'text-delta', text: 'ok' }]))
    await collect(new LLMAgentProvider().run(session, 'hi'))

    expect(mcpConnect).toHaveBeenCalledWith('srv1')
    expect(mcpListTools).toHaveBeenCalledWith('srv1')
    expect(toAiMcpToolMock).toHaveBeenCalledWith('srv1', 'read_file', 'Read a file', expect.any(Function))

    const arg = streamTextMock.mock.calls[0][0] as { tools?: Record<string, unknown>; stopWhen?: unknown }
    expect(Object.keys(arg.tools!)).toContain('mcp__srv1__read_file')
    expect(arg.stopWhen).toBeTruthy()

    // The wrapped call routes back to the registry's callTool for that server/tool.
    const callArg = toAiMcpToolMock.mock.calls[0][3]
    await callArg({ path: '/x' })
    expect(mcpCallTool).toHaveBeenCalledWith('srv1', 'read_file', { path: '/x' })
  })

  it('skips an MCP server that fails to connect without aborting the run', async () => {
    resolveCapsMock.mockResolvedValue({
      tools: new Map(),
      skillBodies: [],
      mcpServerIds: ['bad'],
      warnings: [],
    })
    mcpConnect.mockRejectedValue(new Error('spawn failed'))
    streamTextMock.mockReturnValue(fakeResult([{ type: 'text-delta', text: 'ok' }]))
    const events = await collect(new LLMAgentProvider().run(session, 'hi'))

    // The failed server contributes no tools; listTools is never reached.
    const arg = streamTextMock.mock.calls[0][0] as { tools?: unknown }
    expect(arg.tools).toBeUndefined()
    expect(mcpListTools).not.toHaveBeenCalled()
    // The run still completes normally.
    const statuses = events
      .filter((e) => e.type === 'status-change')
      .map((e) => (e.payload as { status: string }).status)
    expect(statuses).toEqual(['running', 'idle'])
  })
})
