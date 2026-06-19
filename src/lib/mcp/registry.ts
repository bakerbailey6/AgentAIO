/**
 * Manages live connections to Model Context Protocol (MCP) servers.
 *
 * Holds one MCP {@link Client} per connected server (keyed by the stored server
 * id), choosing a `stdio` or `sse` transport from the server's persisted config.
 * Once connected, agents can list and call the server's tools through this
 * registry. Use {@link getMCPRegistry} for the app-wide singleton.
 *
 * @module
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { initDb } from '@/lib/storage'
import { McpRepository } from '@/lib/storage/repositories/mcps'
import { isTauri } from '@/lib/platform'
import { TauriStdioClientTransport } from './tauri-stdio-transport'

interface ConnectedServer {
  client: Client
  serverId: string
}

export class MCPRegistry {
  private connections = new Map<string, ConnectedServer>()

  /**
   * Connect to the stored MCP server `serverId`, if not already connected.
   *
   * Picks a transport from the server's config: `stdio` splits `commandOrUrl`
   * into a command + args, `sse` treats it as a URL.
   *
   * @throws If no MCP server with that id exists in storage.
   */
  async connect(serverId: string): Promise<void> {
    if (this.connections.has(serverId)) return

    const db = await initDb()
    const repo = new McpRepository(db)
    const server = await repo.findById(serverId)
    if (!server) throw new Error(`MCP server not found: ${serverId}`)

    const client = new Client({ name: 'agent-command-center', version: '1.0.0' })

    let transport
    if (server.transport === 'stdio') {
      // stdio MCP servers are spawned via the Tauri sidecar — a Node
      // `child_process` can't run in the webview, and statically importing the
      // SDK's Node stdio transport would pull `cross-spawn`/`child_process` into
      // the static web bundle and break `next build`. So stdio is desktop-only.
      if (!isTauri()) {
        throw new Error('stdio MCP servers require the desktop app.')
      }
      const [cmd, ...args] = server.commandOrUrl.split(' ')
      transport = new TauriStdioClientTransport(cmd, args)
    } else {
      transport = new SSEClientTransport(new URL(server.commandOrUrl))
    }

    await client.connect(transport)
    this.connections.set(serverId, { client, serverId })
  }

  /** Close the connection to `serverId`. A no-op if not connected. */
  async disconnect(serverId: string): Promise<void> {
    const conn = this.connections.get(serverId)
    if (!conn) return
    await conn.client.close()
    this.connections.delete(serverId)
  }

  /** Ids of all currently connected servers. */
  listConnected(): string[] {
    return Array.from(this.connections.keys())
  }

  /**
   * Invoke a tool on a connected server.
   *
   * @throws If `serverId` is not currently connected.
   */
  async callTool(serverId: string, toolName: string, args: unknown): Promise<unknown> {
    const conn = this.connections.get(serverId)
    if (!conn) throw new Error(`MCP server not connected: ${serverId}`)
    return conn.client.callTool({ name: toolName, arguments: args as Record<string, unknown> })
  }

  /**
   * List the tools a connected server exposes.
   *
   * @throws If `serverId` is not currently connected.
   */
  async listTools(serverId: string): Promise<Array<{ name: string; description?: string }>> {
    const conn = this.connections.get(serverId)
    if (!conn) throw new Error(`MCP server not connected: ${serverId}`)
    const result = await conn.client.listTools()
    return result.tools
  }
}

let _registry: MCPRegistry | null = null

/** Return the app-wide MCP registry, creating it on first use. */
export function getMCPRegistry(): MCPRegistry {
  if (!_registry) _registry = new MCPRegistry()
  return _registry
}
