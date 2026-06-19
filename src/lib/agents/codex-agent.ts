/**
 * Coding-agent runtime that drives the `codex` CLI as a child process.
 *
 * Mirrors {@link ClaudeCodeAgentProvider}: the Rust sidecar spawns the process
 * and streams its stdout back as Tauri events, which this provider maps to
 * {@link AgentEvent}s and answers with `yes`/`no` over stdin. The differences
 * are the command (`codex --approval-mode suggest --quiet`), the line types it
 * recognises (`message`/`done`), and that it takes no `allowedPaths`.
 * Desktop-only.
 *
 * @module
 */
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { AgentProvider, AgentEvent, AgentSession, AgentCapabilities } from '@/lib/interfaces'

export interface CodexConfig {
  projectDirectory: string
}

/** Abort the run if no output arrives for this long (ms). */
const TIMEOUT_MS = 30_000

export class CodexAgentProvider implements AgentProvider<CodexConfig, AgentEvent> {
  readonly type = 'codex'
  readonly displayName = 'OpenAI Codex'
  readonly icon = '⚡'

  private processes = new Map<string, string>()
  private approvalSessions = new Map<string, string>() // requestId → sessionId

  async configure(_config: CodexConfig): Promise<void> {}

  /**
   * Spawn the `codex` CLI in the project directory and yield its output as
   * agent events until it emits a `done` line (or stalls past
   * {@link TIMEOUT_MS}). See {@link ClaudeCodeAgentProvider.run} for the
   * queue-and-poll mechanism shared by both coding agents.
   *
   * @throws If the session has no `projectDirectory` (this runtime requires one).
   */
  async *run(session: AgentSession, input: string): AsyncIterable<AgentEvent> {
    yield { type: 'status-change', agentId: session.agentId, timestamp: Date.now(), payload: { status: 'running' } }

    if (!session.projectDirectory) {
      throw new Error(`${this.displayName} requires a project directory`)
    }
    const processId = await invoke<string>('spawn_process', {
      cmd: 'codex',
      args: ['--approval-mode', 'suggest', '--quiet', input],
      cwd: session.projectDirectory,
    })
    this.processes.set(session.id, processId)

    const eventQueue: AgentEvent[] = []
    let done = false

    const unlisten = await listen<string>(`process://stdout/${processId}`, (event) => {
      try {
        const line = JSON.parse(event.payload)
        if (line.type === 'approval-request' && line.requestId) {
          this.approvalSessions.set(line.requestId, session.id)
        }
        eventQueue.push({
          type: line.type === 'message' ? 'text-delta' : line.type === 'approval-request' ? 'approval-request' : 'tool-call',
          agentId: session.agentId,
          timestamp: Date.now(),
          payload: line,
        })
        if (line.type === 'done') done = true
      } catch { /* skip non-JSON */ }
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
      await invoke('send_stdin', { processId, data: 'yes\n' })
    }
  }

  async deny(requestId: string, _reason?: string): Promise<void> {
    const sessionId = this.approvalSessions.get(requestId)
    const processId = sessionId ? this.processes.get(sessionId) : undefined
    if (processId) {
      this.approvalSessions.delete(requestId)
      await invoke('send_stdin', { processId, data: 'no\n' })
    }
  }

  getCapabilities(): AgentCapabilities {
    return { supportsTools: true, supportsStreaming: true, supportsApprovalGates: true, requiresProjectDirectory: true }
  }
}
