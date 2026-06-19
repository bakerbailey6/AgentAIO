import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AgentEvent, AgentSession } from '@/lib/interfaces'

const { streamTextMock, agentFindById, sessionFindById, getAdapterMock } = vi.hoisted(() => ({
  streamTextMock: vi.fn(),
  agentFindById: vi.fn(),
  sessionFindById: vi.fn(),
  getAdapterMock: vi.fn(),
}))

vi.mock('ai', () => ({ streamText: streamTextMock }))
vi.mock('@/lib/llm/router', () => ({
  LLMRouter: vi.fn().mockImplementation(function () { return { getAdapter: getAdapterMock } }),
}))
vi.mock('@/lib/storage', () => ({
  initDb: vi.fn(async () => ({})),
  AgentRepository: vi.fn().mockImplementation(function () { return { findById: agentFindById } }),
  SessionRepository: vi.fn().mockImplementation(function () { return { findById: sessionFindById } }),
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
})
