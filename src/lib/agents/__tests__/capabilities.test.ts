import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { AgentRow } from '@/lib/storage'
import type { ToolDefinition } from '@/lib/interfaces'

// --- Tauri boundary (skills load via invoke; harmless even though we mock @/lib/skills). ---
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))

// --- Storage: initDb returns a sentinel db; ToolRepository is a CLASS (mocked-with-`new`). ---
const { initDbMock, findByIdMock } = vi.hoisted(() => ({
  initDbMock: vi.fn(async () => ({}) as unknown),
  findByIdMock: vi.fn(),
}))

vi.mock('@/lib/storage', () => {
  class ToolRepository {
    findById = findByIdMock
  }
  return { initDb: initDbMock, ToolRepository }
})

// --- Skills: real-ish toSkill returning { body }, readSkillFile a spy. ---
const { readSkillFileMock } = vi.hoisted(() => ({
  readSkillFileMock: vi.fn(),
}))

vi.mock('@/lib/skills', () => ({
  readSkillFile: readSkillFileMock,
  toSkill: (fileName: string, raw: string) => ({
    fileName,
    name: fileName,
    description: '',
    version: '1.0.0',
    frontmatter: {},
    body: raw,
  }),
}))

// --- Tool registry: a small Map keyed by tool name. ---
const webSearchDef = { name: 'web_search', source: 'built-in' } as unknown as ToolDefinition
const { TOOL_REGISTRY } = vi.hoisted(() => ({
  TOOL_REGISTRY: new Map<string, unknown>(),
}))

vi.mock('@/lib/tools/registry', () => ({ TOOL_REGISTRY }))

import { resolveCapabilities } from '@/lib/agents/capabilities'

function makeAgent(overrides: Partial<AgentRow> = {}): AgentRow {
  return {
    id: 'a1',
    name: 'Agent',
    type: 'llm',
    modelId: 'm1',
    systemPrompt: '',
    toolIds: [],
    mcpIds: [],
    canvasX: 0,
    canvasY: 0,
    groupId: null,
    createdAt: 0,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  TOOL_REGISTRY.clear()
  TOOL_REGISTRY.set('web_search', webSearchDef)
})

describe('resolveCapabilities', () => {
  it('resolves a valid tool-row UUID to a tool keyed by name', async () => {
    findByIdMock.mockResolvedValue({ id: 'uuid-1', name: 'web_search' })
    const agent = makeAgent({ toolIds: ['uuid-1'] })

    const result = await resolveCapabilities(agent)

    expect(initDbMock).toHaveBeenCalledTimes(1)
    expect(findByIdMock).toHaveBeenCalledWith('uuid-1')
    expect(result.tools.size).toBe(1)
    expect(result.tools.get('web_search')).toBe(webSearchDef)
    expect(result.warnings).toEqual([])
  })

  it('warns and skips when a tool row is not found', async () => {
    findByIdMock.mockResolvedValue(null)
    const agent = makeAgent({ toolIds: ['missing-uuid'] })

    const result = await resolveCapabilities(agent)

    expect(result.tools.size).toBe(0)
    expect(result.warnings).toEqual(['Tool missing-uuid not found'])
  })

  it('warns and skips when a tool row has no registered implementation', async () => {
    findByIdMock.mockResolvedValue({ id: 'uuid-2', name: 'unregistered_tool' })
    const agent = makeAgent({ toolIds: ['uuid-2'] })

    const result = await resolveCapabilities(agent)

    expect(result.tools.size).toBe(0)
    expect(result.warnings).toEqual([
      'Tool "unregistered_tool" has no registered implementation',
    ])
  })

  it('loads a skill: id via readSkillFile + toSkill into skillBodies', async () => {
    readSkillFileMock.mockResolvedValue('# Skill body markdown')
    const agent = makeAgent({ toolIds: ['skill:foo.md'] })

    const result = await resolveCapabilities(agent)

    expect(readSkillFileMock).toHaveBeenCalledWith('foo.md')
    expect(result.skillBodies).toEqual(['# Skill body markdown'])
    expect(result.warnings).toEqual([])
    // No tool-row ids => DB untouched.
    expect(initDbMock).not.toHaveBeenCalled()
  })

  it('warns (no throw) when a skill fails to load', async () => {
    readSkillFileMock.mockRejectedValue(new Error('boom'))
    const agent = makeAgent({ toolIds: ['skill:bad.md'] })

    const result = await resolveCapabilities(agent)

    expect(result.skillBodies).toEqual([])
    expect(result.warnings).toEqual(['Skill bad.md failed to load: boom'])
  })

  it('keeps skillBodies in toolIds order alongside tool resolution', async () => {
    findByIdMock.mockResolvedValue({ id: 'uuid-1', name: 'web_search' })
    readSkillFileMock
      .mockResolvedValueOnce('body-a')
      .mockResolvedValueOnce('body-b')
    const agent = makeAgent({ toolIds: ['skill:a.md', 'uuid-1', 'skill:b.md'] })

    const result = await resolveCapabilities(agent)

    expect(result.skillBodies).toEqual(['body-a', 'body-b'])
    expect(result.tools.get('web_search')).toBe(webSearchDef)
  })

  it('passes agent.mcpIds straight through to mcpServerIds', async () => {
    const agent = makeAgent({ mcpIds: ['mcp-1', 'mcp-2'] })

    const result = await resolveCapabilities(agent)

    expect(result.mcpServerIds).toEqual(['mcp-1', 'mcp-2'])
    expect(result.mcpServerIds).toBe(agent.mcpIds)
  })

  it('does not touch the DB when there are no tool-row ids', async () => {
    const agent = makeAgent({ toolIds: [], mcpIds: [] })

    const result = await resolveCapabilities(agent)

    expect(initDbMock).not.toHaveBeenCalled()
    expect(findByIdMock).not.toHaveBeenCalled()
    expect(result.tools.size).toBe(0)
    expect(result.skillBodies).toEqual([])
    expect(result.warnings).toEqual([])
  })
})
