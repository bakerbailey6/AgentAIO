/**
 * Coding-agent runtime that drives the `claude` CLI as a child process.
 *
 * The process is spawned through the Rust sidecar (`spawn_process`), which
 * streams the CLI's stdout back as Tauri events. This provider translates that
 * line-delimited `stream-json` output into {@link AgentEvent}s and relays
 * approve/deny decisions back to the process over stdin. Desktop-only: it relies
 * on the Tauri commands and so does nothing in browser mode.
 *
 * @module
 */
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { AgentProvider, AgentEvent, AgentSession, AgentCapabilities } from '@/lib/interfaces'

export interface ClaudeCodeConfig {
  projectDirectory: string
  allowedPaths: string[]
}

/** Abort the run if no output arrives for this long (ms). */
const TIMEOUT_MS = 30_000

export class ClaudeCodeAgentProvider implements AgentProvider<ClaudeCodeConfig, AgentEvent> {
  readonly type = 'claude-code'
  readonly displayName = 'Claude Code'
  readonly icon = '🧑‍💻'

  private processes = new Map<string, string>() // sessionId → processId
  private approvalSessions = new Map<string, string>() // requestId → sessionId

  async configure(_config: ClaudeCodeConfig): Promise<void> {}

  /**
   * Spawn `claude --print --output-format stream-json` in the project directory
   * and yield its output as agent events until the process emits a `result`
   * line (or stalls past {@link TIMEOUT_MS}).
   *
   * The Tauri event callback can't be `yield`ed from directly, so incoming lines
   * are buffered in `eventQueue` and the generator drains that queue on a short
   * poll, mapping each line to a `text-delta`, `approval-request`, or
   * `tool-call` event.
   *
   * @throws If the session has no `projectDirectory` (this runtime requires one).
   */
  async *run(session: AgentSession, input: string): AsyncIterable<AgentEvent> {
    yield { type: 'status-change', agentId: session.agentId, timestamp: Date.now(), payload: { status: 'running' } }

    if (!session.projectDirectory) {
      throw new Error(`${this.displayName} requires a project directory`)
    }
    const processId = await invoke<string>('spawn_process', {
      cmd: 'claude',
      args: ['--print', '--output-format', 'stream-json', input],
      cwd: session.projectDirectory,
    })
    this.processes.set(session.id, processId)

    // Stream stdout lines as agent events via a channel
    const eventQueue: AgentEvent[] = []
    let done = false

    const unlisten = await listen<string>(`process://stdout/${processId}`, (event) => {
      try {
        const line = JSON.parse(event.payload)
        if (line.type === 'approval-request' && line.requestId) {
          this.approvalSessions.set(line.requestId, session.id)
        }
        eventQueue.push({
          type: line.type === 'assistant' ? 'text-delta' : line.type === 'approval-request' ? 'approval-request' : 'tool-call',
          agentId: session.agentId,
          timestamp: Date.now(),
          payload: line,
        })
        if (line.type === 'result') done = true
      } catch {
        // non-JSON line, skip
      }
    })

    let lastActivity = Date.now()
    try {
      while (!done || eventQueue.length > 0) {
        if (eventQueue.length > 0) {
          lastActivity = Date.now()
          yield eventQueue.shift()!
        } else if (Date.now() - lastActivity > TIMEOUT_MS) {
          yield { type: 'error', agentId: session.agentId, timestamp: Date.now(), payload: { error: 'Process timed out' } } as AgentEvent
          break
        } else {
          await new Promise((r) => setTimeout(r, 50))
        }
      }
      yield { type: 'status-change', agentId: session.agentId, timestamp: Date.now(), payload: { status: 'idle' } }
    } finally {
      unlisten()
      this.processes.delete(session.id)
    }
  }

  async stop(sessionId: string): Promise<void> {
    const processId = this.processes.get(sessionId)
    if (processId) {
      await invoke('kill_process', { processId })
      this.processes.delete(sessionId)
    }
  }

  async approve(requestId: string): Promise<void> {
    const sessionId = this.approvalSessions.get(requestId)
    const processId = sessionId ? this.processes.get(sessionId) : undefined
    if (processId) {
      this.approvalSessions.delete(requestId)
      await invoke('send_stdin', { processId, data: 'y\n' })
    }
  }

  async deny(requestId: string, _reason?: string): Promise<void> {
    const sessionId = this.approvalSessions.get(requestId)
    const processId = sessionId ? this.processes.get(sessionId) : undefined
    if (processId) {
      this.approvalSessions.delete(requestId)
      await invoke('send_stdin', { processId, data: 'n\n' })
    }
  }

  getCapabilities(): AgentCapabilities {
    return { supportsTools: true, supportsStreaming: true, supportsApprovalGates: true, requiresProjectDirectory: true }
  }
}
