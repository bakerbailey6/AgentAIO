/**
 * The single seam through which CLI-backed subscription models stream text.
 *
 * Isolates all child-process I/O (spawn / listen / kill, via the Tauri sidecar)
 * behind one async generator, {@link streamCliText}, so the rest of the stack —
 * the {@link CliLanguageModel} adapter and the `claude-cli` / `codex-cli`
 * providers — stays free of Tauri specifics and is trivially testable by mocking
 * this module. Reuses the queue-and-poll relay from the coding-agent runtimes
 * (`claude-code-agent.ts`): a Tauri event callback can't be `yield`ed from
 * directly, so lines are buffered and drained on a short poll.
 *
 * Desktop-only: throws in browser mode where `spawn_process` does not exist.
 *
 * NOTE: the per-CLI JSON line shapes below are best-effort against the documented
 * `claude -p --output-format stream-json` and `codex exec --json` formats. They
 * MUST be confirmed against the installed CLIs on the first real `tauri:dev`
 * run; the `finalText` fallback keeps a single-aggregate result working even if
 * the streaming delta shape drifts.
 *
 * @module
 */
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { isTauri } from '@/lib/platform'

export type CliKind = 'claude' | 'codex'

/** Outcome of parsing one stdout line from a CLI. */
interface ParsedLine {
  /** Incremental text deltas to emit immediately. */
  texts: string[]
  /** A complete aggregate answer, emitted only if no deltas ever streamed. */
  finalText?: string
  /** The CLI signalled end-of-turn. */
  done: boolean
}

interface CliKindConfig {
  cmd: string
  args(prompt: string, modelName?: string): string[]
  parseLine(obj: unknown): ParsedLine
}

const EMPTY: ParsedLine = { texts: [], done: false }

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : undefined
}

const CLI_KINDS: Record<CliKind, CliKindConfig> = {
  claude: {
    cmd: 'claude',
    args: (prompt, modelName) => [
      '-p',
      prompt,
      '--output-format',
      'stream-json',
      '--verbose',
      '--include-partial-messages',
      ...(modelName ? ['--model', modelName] : []),
    ],
    parseLine: (obj) => {
      const o = asRecord(obj)
      if (!o) return EMPTY
      // Streaming partial delta: { type: 'stream_event', event: { delta: { type: 'text_delta', text } } }
      if (o.type === 'stream_event') {
        const delta = asRecord(asRecord(o.event)?.delta)
        if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
          return { texts: [delta.text], done: false }
        }
        return EMPTY
      }
      // Terminal line: { type: 'result', result: '<full answer>' }
      if (o.type === 'result') {
        return { texts: [], done: true, finalText: typeof o.result === 'string' ? o.result : undefined }
      }
      return EMPTY
    },
  },
  codex: {
    cmd: 'codex',
    args: (prompt, modelName) => [
      'exec',
      '--json',
      '--skip-git-repo-check',
      ...(modelName ? ['--model', modelName] : []),
      prompt,
    ],
    parseLine: (obj) => {
      const o = asRecord(obj)
      if (!o) return EMPTY
      const msg = asRecord(o.msg)
      // Streaming delta: { msg: { type: 'agent_message_delta', delta: '<text>' } }
      if (msg?.type === 'agent_message_delta' && typeof msg.delta === 'string') {
        return { texts: [msg.delta], done: false }
      }
      // Completed aggregate item: { type: 'item.completed', item: { type: 'agent_message', text } }
      if (o.type === 'item.completed') {
        const item = asRecord(o.item)
        if (item?.type === 'agent_message' && typeof item.text === 'string') {
          return { texts: [], done: false, finalText: item.text }
        }
        return EMPTY
      }
      // Terminal lines across codex versions.
      if (o.type === 'turn.completed' || o.type === 'done' || msg?.type === 'task_complete') {
        return { texts: [], done: true }
      }
      return EMPTY
    },
  },
}

export interface StreamCliOptions {
  kind: CliKind
  prompt: string
  modelName?: string
  /** Abort after this long with no new output (ms). Mainly for tests/tuning. */
  timeoutMs?: number
  /** Poll interval while draining the line buffer (ms). Mainly for tests. */
  pollMs?: number
}

/**
 * Stream the CLI's answer to `prompt` as text deltas.
 *
 * Spawns the relevant CLI through the Tauri sidecar, relays its stdout lines as
 * incremental text, and ends when the CLI signals end-of-turn (or stalls past
 * `timeoutMs`). If the CLI only produced a single aggregate result (no streamed
 * deltas), that aggregate is emitted once at the end.
 *
 * @throws In browser mode (no Tauri), or if the process stalls past the timeout.
 */
export async function* streamCliText(opts: StreamCliOptions): AsyncIterable<string> {
  if (!isTauri()) {
    throw new Error('CLI subscription models are only available in the desktop app')
  }
  const timeoutMs = opts.timeoutMs ?? 30_000
  const pollMs = opts.pollMs ?? 50
  const cfg = CLI_KINDS[opts.kind]

  const processId = await invoke<string>('spawn_process', {
    cmd: cfg.cmd,
    args: cfg.args(opts.prompt, opts.modelName),
    cwd: null,
  })

  const queue: string[] = []
  let done = false
  let finalText: string | undefined
  let emittedAny = false

  const unlisten = await listen<string>(`process://stdout/${processId}`, (event) => {
    let obj: unknown
    try {
      obj = JSON.parse(event.payload)
    } catch {
      return // non-JSON line (e.g. a stray log) — ignore
    }
    const parsed = cfg.parseLine(obj)
    for (const t of parsed.texts) if (t) queue.push(t)
    if (parsed.finalText !== undefined) finalText = parsed.finalText
    if (parsed.done) done = true
  })

  let lastActivity = Date.now()
  try {
    while (!done || queue.length > 0) {
      if (queue.length > 0) {
        lastActivity = Date.now()
        emittedAny = true
        yield queue.shift()!
      } else if (Date.now() - lastActivity > timeoutMs) {
        throw new Error('CLI process timed out')
      } else {
        await new Promise((r) => setTimeout(r, pollMs))
      }
    }
    if (!emittedAny && finalText) yield finalText
  } finally {
    unlisten()
    await invoke('kill_process', { processId }).catch(() => {})
  }
}
