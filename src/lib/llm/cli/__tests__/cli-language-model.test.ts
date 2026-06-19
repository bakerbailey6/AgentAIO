import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { LanguageModelV2CallOptions, LanguageModelV2StreamPart } from '@ai-sdk/provider'
import { streamText, type LanguageModel } from 'ai'

vi.mock('../cli-invoke', () => ({ streamCliText: vi.fn() }))

import { streamCliText } from '../cli-invoke'
import { CliLanguageModel } from '../cli-language-model'

const mockStream = vi.mocked(streamCliText)

async function* gen(items: string[]): AsyncIterable<string> {
  for (const i of items) yield i
}
async function* genThrow(): AsyncIterable<string> {
  throw new Error('cli boom')
}

async function readAll(stream: ReadableStream<LanguageModelV2StreamPart>): Promise<LanguageModelV2StreamPart[]> {
  const reader = stream.getReader()
  const parts: LanguageModelV2StreamPart[] = []
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    parts.push(value)
  }
  return parts
}

const opts: LanguageModelV2CallOptions = {
  prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
}

beforeEach(() => {
  mockStream.mockReset()
})

describe('CliLanguageModel', () => {
  it('exposes the v2 identity', () => {
    const m = new CliLanguageModel('claude', 'claude-opus-4-8', 'claude-cli')
    expect(m.specificationVersion).toBe('v2')
    expect(m.provider).toBe('claude-cli')
    expect(m.modelId).toBe('claude-opus-4-8')
  })

  it('doStream emits start → text-start → deltas → text-end → finish(stop)', async () => {
    mockStream.mockReturnValue(gen(['Hello', ' world']))
    const m = new CliLanguageModel('claude', 'claude-opus-4-8', 'claude-cli')
    const { stream } = await m.doStream(opts)
    const parts = await readAll(stream)

    expect(parts.map((p) => p.type)).toEqual([
      'stream-start',
      'text-start',
      'text-delta',
      'text-delta',
      'text-end',
      'finish',
    ])
    const deltas = parts.filter((p) => p.type === 'text-delta').map((p) => (p as { delta: string }).delta)
    expect(deltas.join('')).toBe('Hello world')
    const finish = parts.find((p) => p.type === 'finish') as { finishReason: string }
    expect(finish.finishReason).toBe('stop')
  })

  it('doStream emits an error part then finish(error) when the CLI throws', async () => {
    mockStream.mockReturnValue(genThrow())
    const m = new CliLanguageModel('codex', 'gpt-5-codex', 'codex-cli')
    const { stream } = await m.doStream(opts)
    const parts = await readAll(stream)

    expect(parts.some((p) => p.type === 'error')).toBe(true)
    const finish = parts.find((p) => p.type === 'finish') as { finishReason: string }
    expect(finish.finishReason).toBe('error')
  })

  it('doGenerate concatenates deltas into a single text content', async () => {
    mockStream.mockReturnValue(gen(['foo', 'bar']))
    const m = new CliLanguageModel('claude', 'claude-sonnet-4-6', 'claude-cli')
    const res = await m.doGenerate(opts)

    expect(res.content).toEqual([{ type: 'text', text: 'foobar' }])
    expect(res.finishReason).toBe('stop')
  })

  it('flattens system + user text parts into the CLI prompt', async () => {
    mockStream.mockReturnValue(gen(['ok']))
    const m = new CliLanguageModel('claude', 'claude-opus-4-8', 'claude-cli')
    await m.doGenerate({
      prompt: [
        { role: 'system', content: 'Be terse.' },
        { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
      ],
    })
    expect(mockStream).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'claude', prompt: 'Be terse.\n\nHello' }),
    )
  })

  // The decisive integration check: prove ai@6's real streamText accepts and
  // drives our hand-written V2 model end-to-end. If this breaks, the fallback
  // (option B — a dedicated CLI chat agent runtime) is required.
  it('streams through the real ai.streamText pipeline', async () => {
    mockStream.mockReturnValue(gen(['Hello', ' world']))
    const model = new CliLanguageModel('claude', 'claude-opus-4-8', 'claude-cli') as unknown as LanguageModel
    const result = streamText({ model, prompt: 'hi' })
    let text = ''
    for await (const part of result.textStream) text += part
    expect(text).toBe('Hello world')
  })
})
