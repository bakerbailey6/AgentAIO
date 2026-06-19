import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { AgentEvent, AgentSession } from '@/lib/interfaces'

// Capture the Tauri bridge so we can resolve spawn_process and drive stdout events.
const { invokeMock, listenMock, captured } = vi.hoisted(() => {
  const captured = {
    cb: undefined as undefined | ((event: { payload: string }) => void),
    unlisten: vi.fn(),
  }
  return {
    captured,
    invokeMock: vi.fn(),
    listenMock: vi.fn(),
  }
})

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }))
vi.mock('@tauri-apps/api/event', () => ({ listen: listenMock }))

import { CodexAgentProvider } from '@/lib/agents/codex-agent'

const TIMEOUT_MS = 30_000

function makeSession(overrides: Partial<AgentSession> = {}): AgentSession {
  return {
    id: 's1',
    agentId: 'a1',
    projectDirectory: '/tmp/project',
    permissionScope: { allowedPaths: [], allowedDomains: [], shellEnabled: false },
    ...overrides,
  }
}

/** Make `listen` synchronously deliver a scripted set of stdout lines to the run loop. */
function fireLines(lines: Array<Record<string, unknown>>) {
  listenMock.mockImplementation(async (_channel: string, cb: (e: { payload: string }) => void) => {
    captured.cb = cb
    for (const line of lines) cb({ payload: JSON.stringify(line) })
    return captured.unlisten
  })
}

async function collect(iterable: AsyncIterable<AgentEvent>): Promise<AgentEvent[]> {
  const out: AgentEvent[] = []
  for await (const event of iterable) out.push(event)
  return out
}

describe('CodexAgentProvider', () => {
  beforeEach(() => {
    invokeMock.mockReset()
    listenMock.mockReset()
    captured.cb = undefined
    captured.unlisten.mockReset()
    invokeMock.mockImplementation(async (cmd: string) => (cmd === 'spawn_process' ? 'proc-1' : undefined))
    // Default: capture the callback but deliver nothing (used by the timeout test).
    listenMock.mockImplementation(async (_channel: string, cb: (e: { payload: string }) => void) => {
      captured.cb = cb
      return captured.unlisten
    })
  })

  it('spawns the codex process with the right command and cwd', async () => {
    fireLines([{ type: 'done' }])
    const provider = new CodexAgentProvider()
    await collect(provider.run(makeSession(), 'do a thing'))
    expect(invokeMock).toHaveBeenCalledWith('spawn_process', {
      cmd: 'codex',
      args: ['--approval-mode', 'suggest', '--quiet', 'do a thing'],
      cwd: '/tmp/project',
    })
  })

  it('yields running, maps stdout lines to events, then idle', async () => {
    fireLines([
      { type: 'message', text: 'hello' },
      { type: 'approval-request', requestId: 'req1', description: 'rm -rf' },
      { type: 'done' },
    ])
    const provider = new CodexAgentProvider()
    const events = await collect(provider.run(makeSession(), 'hi'))

    expect(events.map((e) => e.type)).toEqual([
      'status-change', // running
      'text-delta', // message
      'approval-request', // approval-request
      'tool-call', // done (anything that is not message/approval-request)
      'status-change', // idle
    ])
    expect(events[0].payload).toEqual({ status: 'running' })
    expect(events.at(-1)!.payload).toEqual({ status: 'idle' })
    expect(events.every((e) => e.agentId === 'a1')).toBe(true)
    expect(captured.unlisten).toHaveBeenCalledTimes(1)
  })

  it('throws when the session has no project directory (after the running event)', async () => {
    const provider = new CodexAgentProvider()
    const it = provider.run(makeSession({ projectDirectory: undefined }), 'hi')[Symbol.asyncIterator]()
    expect((await it.next()).value).toMatchObject({ type: 'status-change', payload: { status: 'running' } })
    await expect(it.next()).rejects.toThrow(/requires a project directory/)
    expect(invokeMock).not.toHaveBeenCalledWith('spawn_process', expect.anything())
  })

  it('approve resolves the pending request and writes "yes\\n" to stdin', async () => {
    fireLines([{ type: 'approval-request', requestId: 'req1' }, { type: 'done' }])
    const provider = new CodexAgentProvider()

    for await (const event of provider.run(makeSession(), 'hi')) {
      if (event.type === 'approval-request') {
        await provider.approve((event.payload as { requestId: string }).requestId)
      }
    }

    expect(invokeMock).toHaveBeenCalledWith('send_stdin', { processId: 'proc-1', data: 'yes\n' })
  })

  it('deny resolves the pending request and writes "no\\n" to stdin', async () => {
    fireLines([{ type: 'approval-request', requestId: 'req1' }, { type: 'done' }])
    const provider = new CodexAgentProvider()

    for await (const event of provider.run(makeSession(), 'hi')) {
      if (event.type === 'approval-request') {
        await provider.deny((event.payload as { requestId: string }).requestId, 'nope')
      }
    }

    expect(invokeMock).toHaveBeenCalledWith('send_stdin', { processId: 'proc-1', data: 'no\n' })
  })

  it('stop kills the running process while a run is in flight', async () => {
    fireLines([{ type: 'approval-request', requestId: 'req1' }, { type: 'done' }])
    const provider = new CodexAgentProvider()

    for await (const event of provider.run(makeSession(), 'hi')) {
      if (event.type === 'approval-request') {
        await provider.stop('s1')
      }
    }

    expect(invokeMock).toHaveBeenCalledWith('kill_process', { processId: 'proc-1' })
  })

  it('approve / deny / stop on an unknown id are silent no-ops', async () => {
    const provider = new CodexAgentProvider()
    await expect(provider.approve('nope')).resolves.toBeUndefined()
    await expect(provider.deny('nope', 'reason')).resolves.toBeUndefined()
    await expect(provider.stop('nope')).resolves.toBeUndefined()
    expect(invokeMock).not.toHaveBeenCalledWith('send_stdin', expect.anything())
    expect(invokeMock).not.toHaveBeenCalledWith('kill_process', expect.anything())
  })

  it('yields a timeout error after 30s of inactivity', async () => {
    vi.useFakeTimers()
    try {
      const provider = new CodexAgentProvider()
      const it = provider.run(makeSession(), 'hi')[Symbol.asyncIterator]()

      expect((await it.next()).value).toMatchObject({ type: 'status-change', payload: { status: 'running' } })

      const pending = it.next()
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(TIMEOUT_MS + 100)

      const result = await pending
      expect(result.value).toMatchObject({ type: 'error', payload: { error: 'Process timed out' } })

      await it.return?.(undefined)
    } finally {
      vi.useRealTimers()
    }
  })

  it('reports capabilities for a coding agent', () => {
    expect(new CodexAgentProvider().getCapabilities()).toEqual({
      supportsTools: true,
      supportsStreaming: true,
      supportsApprovalGates: true,
      requiresProjectDirectory: true,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })
})
