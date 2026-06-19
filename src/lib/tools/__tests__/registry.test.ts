import { describe, it, expect } from 'vitest'
import { TOOL_REGISTRY, registerTool, listBuiltInTools } from '../registry'
import type { PermissionScope } from '@/lib/interfaces'
import type { ToolDefinition, ToolContext } from '@/lib/interfaces'

// NOTE: the key assertion below is intentionally exhaustive — add a new built-in
// tool and you must update this array (mirrors the provider/agent registry tests).
const BUILT_IN_KEYS = [
  'browser',
  'file_read',
  'file_write',
  'image_generation',
  'shell',
  'web_search',
]

function ctx(scope: Partial<PermissionScope> = {}): ToolContext {
  return {
    agentId: 'a1',
    sessionId: 's1',
    permissionScope: {
      allowedPaths: [],
      allowedDomains: [],
      shellEnabled: false,
      ...scope,
    },
  }
}

describe('TOOL_REGISTRY', () => {
  it('is a Map keyed by the built-in tool names', () => {
    expect(TOOL_REGISTRY).toBeInstanceOf(Map)
    expect([...TOOL_REGISTRY.keys()].sort()).toEqual(BUILT_IN_KEYS)
  })

  it('maps each key to a tool whose .name matches the key', () => {
    for (const [key, tool] of TOOL_REGISTRY) {
      expect(tool.name).toBe(key)
    }
  })

  it('every built-in declares source, version, an object inputSchema, and execute', () => {
    for (const tool of TOOL_REGISTRY.values()) {
      expect(tool.source).toBe('built-in')
      expect(tool.version).toMatch(/^\d+\.\d+\.\d+$/)
      expect(tool.description.length).toBeGreaterThan(0)
      expect(tool.inputSchema.type).toBe('object')
      expect(typeof tool.execute).toBe('function')
    }
  })

  it('listBuiltInTools returns every built-in tool', () => {
    expect(listBuiltInTools().map((t) => t.name).sort()).toEqual(BUILT_IN_KEYS)
  })
})

describe('built-in tool permission guards', () => {
  it('shell refuses when the scope does not enable shell', async () => {
    const shell = TOOL_REGISTRY.get('shell')!
    await expect(shell.execute({ command: 'ls' }, ctx({ shellEnabled: false }))).rejects.toThrow(
      /denied by this agent/i,
    )
  })

  it('shell passes the guard, then requires the desktop app to execute', async () => {
    const shell = TOOL_REGISTRY.get('shell')!
    // Shell is wired (Phase 4) to the native run_process_blocking backend; with
    // the guard satisfied it reaches that backend, which only exists in the Tauri
    // desktop shell — so in the web/test environment it reports as much.
    await expect(shell.execute({ command: 'ls' }, ctx({ shellEnabled: true }))).rejects.toThrow(
      /desktop app/i,
    )
  })

  it('file_read refuses a path outside the allowed roots', async () => {
    const read = TOOL_REGISTRY.get('file_read')!
    await expect(read.execute({ path: '/etc/passwd' }, ctx({ allowedPaths: ['/home/u'] }))).rejects.toThrow(
      /outside this agent/i,
    )
  })

  it('web_search refuses when the search host is not in allowed domains', async () => {
    const search = TOOL_REGISTRY.get('web_search')!
    await expect(search.execute({ query: 'hi' }, ctx({ allowedDomains: [] }))).rejects.toThrow(
      /not in this agent/i,
    )
  })
})

describe('registerTool', () => {
  function makeTool(name: string): ToolDefinition {
    return {
      name,
      description: 'test tool',
      source: 'custom',
      version: '1.0.0',
      inputSchema: { type: 'object' },
      execute: async () => null,
    }
  }

  it('adds a tool keyed by its name', () => {
    const tool = makeTool('custom-test')
    try {
      registerTool(tool)
      expect(TOOL_REGISTRY.get('custom-test')).toBe(tool)
    } finally {
      TOOL_REGISTRY.delete('custom-test')
    }
  })

  it('overwrites an existing tool with the same name', () => {
    const first = makeTool('custom-test')
    const second = makeTool('custom-test')
    try {
      registerTool(first)
      registerTool(second)
      expect(TOOL_REGISTRY.get('custom-test')).toBe(second)
    } finally {
      TOOL_REGISTRY.delete('custom-test')
    }
  })
})
