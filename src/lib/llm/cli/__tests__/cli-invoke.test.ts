import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  lines: [] as string[],
  tauri: true,
  spawnId: 'proc-1',
  killed: [] as string[],
  lastSpawnArgs: undefined as unknown,
}))

vi.mock('@/lib/platform', () => ({ isTauri: () => h.tauri }))
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async (cmd: string, args: Record<string, unknown>) => {
    if (cmd === 'spawn_process') {
      h.lastSpawnArgs = args
      return h.spawnId
    }
    if (cmd === 'kill_process') {
      h.killed.push(args.processId as string)
      return undefined
    }
    throw new Error(`unknown cmd ${cmd}`)
  }),
}))
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (_event: string, handler: (e: { payload: string }) => void) => {
    for (const l of h.lines) handler({ payload: l })
    return () => {}
  }),
}))

import { streamCliText } from '@/lib/llm/cli/cli-invoke'

async function collect(it: AsyncIterable<string>): Promise<string[]> {
  const out: string[] = []
  for await (const t of it) out.push(t)
  return out
}

beforeEach(() => {
  h.lines = []
  h.tauri = true
  h.killed = []
  h.lastSpawnArgs = undefined
})

describe('streamCliText', () => {
  it('streams claude text deltas and ends on the result line', async () => {
    h.lines = [
      JSON.stringify({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } } }),
      JSON.stringify({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: ' world' } } }),
      JSON.stringify({ type: 'result', result: 'Hello world' }),
    ]
    const out = await collect(streamCliText({ kind: 'claude', prompt: 'hi' }))
    expect(out).toEqual(['Hello', ' world'])
  })

  it('emits the aggregate result when no deltas streamed (json-mode fallback)', async () => {
    h.lines = [JSON.stringify({ type: 'result', result: 'Just this' })]
    const out = await collect(streamCliText({ kind: 'claude', prompt: 'hi' }))
    expect(out).toEqual(['Just this'])
  })

  it('streams codex text deltas and ends on turn.completed', async () => {
    h.lines = [
      JSON.stringify({ msg: { type: 'agent_message_delta', delta: 'Hi' } }),
      JSON.stringify({ msg: { type: 'agent_message_delta', delta: ' there' } }),
      JSON.stringify({ type: 'turn.completed' }),
    ]
    const out = await collect(streamCliText({ kind: 'codex', prompt: 'hi' }))
    expect(out.join('')).toBe('Hi there')
  })

  it('passes the expected claude args to spawn_process', async () => {
    h.lines = [JSON.stringify({ type: 'result', result: 'x' })]
    await collect(streamCliText({ kind: 'claude', prompt: 'hi', modelName: 'claude-opus-4-8' }))
    const args = (h.lastSpawnArgs as { cmd: string; args: string[] })
    expect(args.cmd).toBe('claude')
    expect(args.args).toContain('--output-format')
    expect(args.args).toContain('stream-json')
    expect(args.args).toEqual(expect.arrayContaining(['--model', 'claude-opus-4-8']))
  })

  it('kills the spawned process on completion', async () => {
    h.lines = [JSON.stringify({ type: 'result', result: 'done' })]
    await collect(streamCliText({ kind: 'claude', prompt: 'hi' }))
    expect(h.killed).toContain('proc-1')
  })

  it('throws in browser mode', async () => {
    h.tauri = false
    await expect(collect(streamCliText({ kind: 'claude', prompt: 'hi' }))).rejects.toThrow('desktop app')
  })

  it('throws when the process stalls past the timeout', async () => {
    h.lines = [] // no terminal line, no output
    await expect(
      collect(streamCliText({ kind: 'claude', prompt: 'hi', timeoutMs: 50, pollMs: 10 })),
    ).rejects.toThrow('timed out')
  })
})
