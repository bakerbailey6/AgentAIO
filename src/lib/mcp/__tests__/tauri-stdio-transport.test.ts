import { describe, it, expect, vi, beforeEach } from 'vitest'

const { invokeMock, listenMock, handlers, unlistenStdout, unlistenStderr } = vi.hoisted(() => {
  const handlers: Record<string, (e: { payload: string }) => void> = {}
  const unlistenStdout = vi.fn()
  const unlistenStderr = vi.fn()
  return {
    invokeMock: vi.fn(),
    handlers,
    unlistenStdout,
    unlistenStderr,
    listenMock: vi.fn(async (event: string, handler: (e: { payload: string }) => void) => {
      handlers[event] = handler
      return event.includes('stdout') ? unlistenStdout : unlistenStderr
    }),
  }
})

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }))
vi.mock('@tauri-apps/api/event', () => ({ listen: listenMock }))

import { TauriStdioClientTransport } from '@/lib/mcp/tauri-stdio-transport'

describe('TauriStdioClientTransport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const k of Object.keys(handlers)) delete handlers[k]
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'spawn_process') return 'proc-1'
      return undefined
    })
  })

  it('start() spawns the process and routes stdout lines to onmessage', async () => {
    const t = new TauriStdioClientTransport('npx', ['server-x'], '/work')
    const received: unknown[] = []
    t.onmessage = (m) => received.push(m)
    await t.start()

    expect(invokeMock).toHaveBeenCalledWith('spawn_process', { cmd: 'npx', args: ['server-x'], cwd: '/work' })
    expect(listenMock).toHaveBeenCalledWith('process://stdout/proc-1', expect.any(Function))

    handlers['process://stdout/proc-1']({ payload: JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} }) })
    expect(received).toEqual([{ jsonrpc: '2.0', id: 1, result: {} }])
  })

  it('reports a malformed stdout line via onerror, not onmessage', async () => {
    const t = new TauriStdioClientTransport('npx', [])
    const errs: Error[] = []
    const msgs: unknown[] = []
    t.onerror = (e) => errs.push(e)
    t.onmessage = (m) => msgs.push(m)
    await t.start()

    handlers['process://stdout/proc-1']({ payload: 'not json{' })
    expect(msgs).toHaveLength(0)
    expect(errs).toHaveLength(1)
    expect(errs[0].message).toMatch(/invalid json-rpc/i)
  })

  it('send() writes serialized JSON + newline to stdin', async () => {
    const t = new TauriStdioClientTransport('npx', [])
    await t.start()
    await t.send({ jsonrpc: '2.0', id: 2, method: 'ping' } as never)
    expect(invokeMock).toHaveBeenCalledWith('send_stdin', {
      processId: 'proc-1',
      data: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'ping' }) + '\n',
    })
  })

  it('send() before start() throws', async () => {
    const t = new TauriStdioClientTransport('npx', [])
    await expect(t.send({ jsonrpc: '2.0', id: 1, method: 'x' } as never)).rejects.toThrow(/not started/i)
  })

  it('start() twice throws', async () => {
    const t = new TauriStdioClientTransport('npx', [])
    await t.start()
    await expect(t.start()).rejects.toThrow(/already started/i)
  })

  it('close() unlistens, kills the process, and fires onclose', async () => {
    const t = new TauriStdioClientTransport('npx', [])
    const closed = vi.fn()
    t.onclose = closed
    await t.start()
    await t.close()

    expect(unlistenStdout).toHaveBeenCalled()
    expect(unlistenStderr).toHaveBeenCalled()
    expect(invokeMock).toHaveBeenCalledWith('kill_process', { processId: 'proc-1' })
    expect(closed).toHaveBeenCalled()
  })
})
