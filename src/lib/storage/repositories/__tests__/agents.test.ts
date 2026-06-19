import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    execute: vi.fn(async (_sql: string, _params?: unknown[]) => ({ rowsAffected: 1 })),
    select: vi.fn(async () => [] as unknown[]),
  },
}))
vi.mock('@tauri-apps/plugin-sql', () => ({ default: { load: vi.fn(async () => mockDb) } }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => null) }))

import { AgentRepository } from '@/lib/storage/repositories/agents'

function makeRepo() {
  return new AgentRepository(mockDb as never)
}

describe('AgentRepository', () => {
  beforeEach(() => vi.clearAllMocks())

  it('create issues INSERT INTO agents and JSON-encodes tool_ids / mcp_ids', async () => {
    const repo = makeRepo()
    const id = await repo.create({ name: 'a', type: 'llm', toolIds: ['web_search'], mcpIds: ['m1'] })
    const [sql, params] = mockDb.execute.mock.calls[0]
    expect(sql).toContain('INSERT INTO agents')
    expect(params?.[0]).toBe(id)
    expect(params).toContain(JSON.stringify(['web_search']))
    expect(params).toContain(JSON.stringify(['m1']))
  })

  it('updateToolIds issues an UPDATE that JSON-encodes the ids', async () => {
    const repo = makeRepo()
    await repo.updateToolIds('agent-1', ['web_search', 'skill:code-review.md'])
    expect(mockDb.execute).toHaveBeenCalledWith(
      'UPDATE agents SET tool_ids = $1 WHERE id = $2',
      [JSON.stringify(['web_search', 'skill:code-review.md']), 'agent-1'],
    )
  })

  it('findAll maps snake_case → camelCase and parses tool_ids / mcp_ids', async () => {
    mockDb.select.mockResolvedValueOnce([
      {
        id: 'agent-1',
        name: 'A',
        type: 'llm',
        model_id: null,
        system_prompt: '',
        tool_ids: '["web_search"]',
        mcp_ids: '[]',
        canvas_x: 1,
        canvas_y: 2,
        group_id: null,
        created_at: 7,
      },
    ])
    const repo = makeRepo()
    const rows = await repo.findAll()
    expect(mockDb.select).toHaveBeenCalledWith('SELECT * FROM agents')
    expect(rows[0].toolIds).toEqual(['web_search'])
    expect(rows[0].mcpIds).toEqual([])
  })
})
