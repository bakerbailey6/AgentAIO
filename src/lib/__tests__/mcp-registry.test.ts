import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn().mockImplementation(function () {
    return {
      connect: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
      listTools: vi.fn(async () => ({ tools: [{ name: 'test-tool' }] })),
      callTool: vi.fn(async () => ({ content: [{ type: 'text', text: 'result' }] })),
    }
  }),
}))
vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: vi.fn().mockImplementation(function () { return {} }),
}))
vi.mock('@/lib/storage', () => ({
  initDb: vi.fn(async () => ({
    select: vi.fn(async () => [{
      id: 'mcp-1', name: 'filesystem', transport: 'stdio',
      command_or_url: 'npx @modelcontextprotocol/server-filesystem /tmp',
      env_vars_ref: '[]', enabled: 1,
    }]),
  })),
}))

import { MCPRegistry } from '@/lib/mcp/registry'

describe('MCPRegistry', () => {
  it('connects a stdio MCP server', async () => {
    const registry = new MCPRegistry()
    await registry.connect('mcp-1')
    expect(registry.listConnected()).toContain('mcp-1')
  })

  it('disconnects a connected server', async () => {
    const registry = new MCPRegistry()
    await registry.connect('mcp-1')
    await registry.disconnect('mcp-1')
    expect(registry.listConnected()).not.toContain('mcp-1')
  })
})
