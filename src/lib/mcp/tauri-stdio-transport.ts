/**
 * An MCP {@link Transport} that speaks stdio over the Tauri sidecar.
 *
 * The official `StdioClientTransport` spawns a Node `child_process`, which does
 * not exist in the Tauri webview — so stdio MCP servers (every entry in
 * `MCP_CATALOG`) can't connect there. This transport bridges the gap: it frames
 * MCP's newline-delimited JSON-RPC over the existing process commands —
 * `spawn_process` (whose stdout is already emitted line-by-line on
 * `process://stdout/<id>`), `send_stdin`, and `kill_process`. MCP stdio framing
 * is one JSON message per line, which lines up exactly with the sidecar's
 * line-buffered stdout, so no extra buffering is required.
 *
 * Only usable in the desktop shell; {@link MCPRegistry} uses it for stdio
 * servers when `isTauri()` is true and otherwise rejects stdio — the SDK's Node
 * stdio transport is intentionally not bundled into the static web build.
 *
 * @module
 */
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js'

export class TauriStdioClientTransport implements Transport {
  private processId?: string
  private unlistenStdout?: UnlistenFn
  private unlistenStderr?: UnlistenFn

  onclose?: () => void
  onerror?: (error: Error) => void
  onmessage?: (message: JSONRPCMessage) => void

  constructor(
    private readonly command: string,
    private readonly args: string[] = [],
    private readonly cwd?: string,
  ) {}

  /**
   * Spawn the server and begin routing its stdout lines as JSON-RPC messages.
   *
   * The server stays quiet until it receives the client's `initialize` request,
   * so spawning before attaching the stdout listener cannot drop early output.
   */
  async start(): Promise<void> {
    if (this.processId) {
      throw new Error('TauriStdioClientTransport already started')
    }
    const id = await invoke<string>('spawn_process', {
      cmd: this.command,
      args: this.args,
      cwd: this.cwd,
    })
    this.processId = id

    this.unlistenStdout = await listen<string>(`process://stdout/${id}`, (event) => {
      const line = event.payload
      if (!line) return
      let message: JSONRPCMessage
      try {
        message = JSON.parse(line) as JSONRPCMessage
      } catch {
        this.onerror?.(new Error(`Invalid JSON-RPC line from MCP server: ${line}`))
        return
      }
      this.onmessage?.(message)
    })

    // MCP servers log diagnostics to stderr; surface them via onerror but never
    // treat them as fatal — the connection lives on stdout.
    this.unlistenStderr = await listen<string>(`process://stderr/${id}`, (event) => {
      if (event.payload) this.onerror?.(new Error(`MCP server stderr: ${event.payload}`))
    })
  }

  /** Serialize and write one JSON-RPC message to the server's stdin. */
  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.processId) {
      throw new Error('TauriStdioClientTransport not started')
    }
    await invoke('send_stdin', {
      processId: this.processId,
      data: JSON.stringify(message) + '\n',
    })
  }

  /** Stop listening, kill the child, and signal close. */
  async close(): Promise<void> {
    this.unlistenStdout?.()
    this.unlistenStderr?.()
    this.unlistenStdout = undefined
    this.unlistenStderr = undefined
    if (this.processId) {
      try {
        await invoke('kill_process', { processId: this.processId })
      } catch {
        /* already exited — nothing to kill */
      }
      this.processId = undefined
    }
    this.onclose?.()
  }
}
