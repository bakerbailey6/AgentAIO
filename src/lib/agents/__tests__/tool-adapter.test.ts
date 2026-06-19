import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ToolDefinition, PermissionScope } from '@/lib/interfaces'

// Mock the AI SDK so `tool`/`dynamicTool` return their config object verbatim,
// letting us invoke `result.execute(input)` directly. `jsonSchema` is wrapped so
// we can assert it was applied without depending on its real output shape.
vi.mock('ai', () => ({
  tool: (config: unknown) => config,
  dynamicTool: (config: unknown) => config,
  jsonSchema: (schema: unknown) => ({ __schema: schema }),
}))

// Mock Task A's approval gate. Hoisted so the factory can close over it.
const requestApprovalMock = vi.hoisted(() => vi.fn())
vi.mock('../approval-gate', () => ({
  requestApproval: requestApprovalMock,
}))

import { toAiTool, toAiMcpTool, needsApproval, mcpToolKey } from '../tool-adapter'

const scope: PermissionScope = {
  allowedPaths: [],
  allowedDomains: [],
  shellEnabled: false,
}

const ctx = {
  agentId: 'agent-1',
  sessionId: 'session-1',
  permissionScope: scope,
}

function makeTool(name: string): ToolDefinition & { execute: ReturnType<typeof vi.fn> } {
  return {
    name,
    description: `desc for ${name}`,
    source: 'built-in',
    version: '1.0.0',
    inputSchema: { type: 'object', properties: { q: { type: 'string' } } },
    execute: vi.fn(async () => `${name} ran`),
  }
}

// The `ai` mock makes `tool()` return the config object directly.
type ToolConfig = {
  description: string
  inputSchema: unknown
  execute: (input: unknown) => Promise<unknown>
}

beforeEach(() => {
  requestApprovalMock.mockReset()
})

describe('toAiTool', () => {
  it('builds a tool from the definition (description + inputSchema)', () => {
    const def = makeTool('web_search')
    const result = toAiTool(def, ctx) as unknown as ToolConfig
    expect(result.description).toBe('desc for web_search')
    expect(result.inputSchema).toEqual({ __schema: def.inputSchema })
  })

  it('runs a non-dangerous tool without requesting approval', async () => {
    const def = makeTool('web_search')
    const result = toAiTool(def, ctx) as unknown as ToolConfig

    const out = await result.execute({ q: 'hello' })

    expect(requestApprovalMock).not.toHaveBeenCalled()
    expect(def.execute).toHaveBeenCalledWith(
      { q: 'hello' },
      { agentId: 'agent-1', sessionId: 'session-1', permissionScope: scope },
    )
    expect(out).toBe('web_search ran')
  })

  it('requests high-risk approval for shell and runs it when approved', async () => {
    requestApprovalMock.mockResolvedValue(true)
    const def = makeTool('shell')
    const result = toAiTool(def, ctx) as unknown as ToolConfig

    const out = await result.execute({ cmd: 'ls' })

    expect(requestApprovalMock).toHaveBeenCalledWith({
      agentId: 'agent-1',
      sessionId: 'session-1',
      action: 'shell',
      description: 'Run shell',
      risk: 'high',
    })
    expect(def.execute).toHaveBeenCalledWith(
      { cmd: 'ls' },
      { agentId: 'agent-1', sessionId: 'session-1', permissionScope: scope },
    )
    expect(out).toBe('shell ran')
  })

  it('returns a denial string and does not run shell when denied', async () => {
    requestApprovalMock.mockResolvedValue(false)
    const def = makeTool('shell')
    const result = toAiTool(def, ctx) as unknown as ToolConfig

    const out = await result.execute({ cmd: 'ls' })

    expect(requestApprovalMock).toHaveBeenCalledTimes(1)
    expect(out).toBe('Denied by user: shell was not run.')
    expect(def.execute).not.toHaveBeenCalled()
  })

  it('uses medium risk for file_write', async () => {
    requestApprovalMock.mockResolvedValue(true)
    const def = makeTool('file_write')
    const result = toAiTool(def, ctx) as unknown as ToolConfig

    await result.execute({ path: 'a.txt', content: 'x' })

    expect(requestApprovalMock).toHaveBeenCalledWith({
      agentId: 'agent-1',
      sessionId: 'session-1',
      action: 'file_write',
      description: 'Run file_write',
      risk: 'medium',
    })
  })

  it('propagates errors thrown by def.execute (does not swallow)', async () => {
    const def = makeTool('web_search')
    const boom = new Error('boom')
    def.execute.mockRejectedValue(boom)
    const result = toAiTool(def, ctx) as unknown as ToolConfig

    await expect(result.execute({ q: 'x' })).rejects.toThrow('boom')
  })
})

describe('needsApproval', () => {
  it('is true for dangerous tools and false otherwise', () => {
    expect(needsApproval('shell', scope)).toBe(true)
    expect(needsApproval('file_write', scope)).toBe(true)
    expect(needsApproval('web_search', scope)).toBe(false)
    expect(needsApproval('file_read', scope)).toBe(false)
  })
})

describe('toAiMcpTool / mcpToolKey', () => {
  it('mcpToolKey namespaces by server', () => {
    expect(mcpToolKey('srv', 'x')).toBe('mcp__srv__x')
  })

  it('wraps an MCP call as a dynamic tool whose execute forwards input', async () => {
    const call = vi.fn(async (input: unknown) => ({ echoed: input }))
    const result = toAiMcpTool('srv', 'x', 'an mcp tool', call) as unknown as ToolConfig

    expect(result.description).toBe('an mcp tool')
    const out = await result.execute({ a: 1 })
    expect(call).toHaveBeenCalledWith({ a: 1 })
    expect(out).toEqual({ echoed: { a: 1 } })
  })
})
