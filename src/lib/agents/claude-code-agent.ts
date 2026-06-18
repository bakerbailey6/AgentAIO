// src/lib/agents/claude-code-agent.ts
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { AgentProvider, AgentEvent, AgentSession, AgentCapabilities } from '@/lib/interfaces'

export interface ClaudeCodeConfig {
  projectDirectory: string
  allowedPaths: string[]
}

export class ClaudeCodeAgentProvider implements AgentProvider<ClaudeCodeConfig, AgentEvent> {
  readonly type = 'claude-code'
  readonly displayName = 'Claude Code'
  readonly icon = '🧑‍💻'

  private processes = new Map<string, string>() // sessionId → processId

  async configure(_config: ClaudeCodeConfig): Promise<void> {}

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
        eventQueue.push({
          type: line.type === 'assistant' ? 'text-delta' : 'tool-call',
          agentId: session.agentId,
          timestamp: Date.now(),
          payload: line,
        })
        if (line.type === 'result') done = true
      } catch {
        // non-JSON line, skip
      }
    })

    try {
      while (!done || eventQueue.length > 0) {
        if (eventQueue.length > 0) {
          yield eventQueue.shift()!
        } else {
          await new Promise((r) => setTimeout(r, 50))
        }
      }
    } finally {
      unlisten()
      this.processes.delete(session.id)
    }

    yield { type: 'status-change', agentId: session.agentId, timestamp: Date.now(), payload: { status: 'idle' } }
  }

  async stop(sessionId: string): Promise<void> {
    const processId = this.processes.get(sessionId)
    if (processId) {
      await invoke('kill_process', { processId })
      this.processes.delete(sessionId)
    }
  }

  async approve(requestId: string): Promise<void> {
    const processId = this.processes.get(requestId)
    if (processId) await invoke('send_stdin', { processId, data: 'y\n' })
  }

  async deny(requestId: string, _reason?: string): Promise<void> {
    const processId = this.processes.get(requestId)
    if (processId) await invoke('send_stdin', { processId, data: 'n\n' })
  }

  getCapabilities(): AgentCapabilities {
    return { supportsTools: true, supportsStreaming: true, supportsApprovalGates: true, requiresProjectDirectory: true }
  }
}
