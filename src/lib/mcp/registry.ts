// src/lib/mcp/registry.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { initDb } from '@/lib/storage'
import { McpRepository } from '@/lib/storage/repositories/mcps'

interface ConnectedServer {
  client: Client
  serverId: string
}

export class MCPRegistry {
  private connections = new Map<string, ConnectedServer>()

  async connect(serverId: string): Promise<void> {
    if (this.connections.has(serverId)) return

    const db = await initDb()
    const repo = new McpRepository(db)
    const server = await repo.findById(serverId)
    if (!server) throw new Error(`MCP server not found: ${serverId}`)

    const client = new Client({ name: 'agent-command-center', version: '1.0.0' })

    let transport
    if (server.transport === 'stdio') {
      const [cmd, ...args] = server.commandOrUrl.split(' ')
      transport = new StdioClientTransport({ command: cmd, args })
    } else {
      transport = new SSEClientTransport(new URL(server.commandOrUrl))
    }

    await client.connect(transport)
    this.connections.set(serverId, { client, serverId })
  }

  async disconnect(serverId: string): Promise<void> {
    const conn = this.connections.get(serverId)
    if (!conn) return
    await conn.client.close()
    this.connections.delete(serverId)
  }

  listConnected(): string[] {
    return Array.from(this.connections.keys())
  }

  async callTool(serverId: string, toolName: string, args: unknown): Promise<unknown> {
    const conn = this.connections.get(serverId)
    if (!conn) throw new Error(`MCP server not connected: ${serverId}`)
    return conn.client.callTool({ name: toolName, arguments: args as Record<string, unknown> })
  }

  async listTools(serverId: string): Promise<Array<{ name: string; description?: string }>> {
    const conn = this.connections.get(serverId)
    if (!conn) throw new Error(`MCP server not connected: ${serverId}`)
    const result = await conn.client.listTools()
    return result.tools
  }
}

let _registry: MCPRegistry | null = null
export function getMCPRegistry(): MCPRegistry {
  if (!_registry) _registry = new MCPRegistry()
  return _registry
}
