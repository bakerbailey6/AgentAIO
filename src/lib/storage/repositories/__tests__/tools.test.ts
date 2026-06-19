import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    execute: vi.fn(async (_sql: string, _params?: unknown[]) => ({ rowsAffected: 1 })),
    select: vi.fn(async () => [] as unknown[]),
  },
}))
vi.mock('@tauri-apps/plugin-sql', () => ({ default: { load: vi.fn(async () => mockDb) } }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => null) }))

import { ToolRepository } from '@/lib/storage/repositories/tools'

function makeRepo() {
  return new ToolRepository(mockDb as never)
}

describe('ToolRepository', () => {
  beforeEach(() => vi.clearAllMocks())

  it('create issues INSERT INTO tools and JSON-encodes definition', async () => {
    const repo = makeRepo()
    const definition = { params: { type: 'object' } }
    const id = await repo.create({
      name: 'search',
      description: 'Web search',
      source: 'registry',
      version: '2.0.0',
      definition,
    })

    expect(typeof id).toBe('string')
    const [sql, params] = mockDb.execute.mock.calls[0]
    expect(sql).toContain('INSERT INTO tools')
    expect(params).toEqual([id, 'search', 'Web search', 'registry', '2.0.0', JSON.stringify(definition)])
  })

  it('create defaults version to 1.0.0 and definition to {} when omitted', async () => {
    const repo = makeRepo()
    const id = await repo.create({
      name: 'echo',
      description: 'Echo tool',
      source: 'built-in',
    })
    const [, params] = mockDb.execute.mock.calls[0]
    expect(params).toEqual([id, 'echo', 'Echo tool', 'built-in', '1.0.0', '{}'])
  })

  it('findAll maps snake_case → camelCase and parses definition', async () => {
    mockDb.select.mockResolvedValueOnce([
      {
        id: 't1',
        name: 'search',
        description: 'Web search',
        source: 'registry',
        version: '2.0.0',
        definition: '{"params":{"type":"object"}}',
        created_at: 7,
      },
    ])
    const repo = makeRepo()
    const rows = await repo.findAll()

    expect(mockDb.select).toHaveBeenCalledWith('SELECT * FROM tools')
    expect(rows).toEqual([
      {
        id: 't1',
        name: 'search',
        description: 'Web search',
        source: 'registry',
        version: '2.0.0',
        definition: { params: { type: 'object' } },
        createdAt: 7,
      },
    ])
  })

  it('findById returns the deserialized row when present', async () => {
    mockDb.select.mockResolvedValueOnce([
      {
        id: 't1',
        name: 'echo',
        description: 'Echo',
        source: 'custom',
        version: '1.0.0',
        definition: '{}',
        created_at: 0,
      },
    ])
    const repo = makeRepo()
    const row = await repo.findById('t1')

    expect(mockDb.select).toHaveBeenCalledWith('SELECT * FROM tools WHERE id = $1', ['t1'])
    expect(row).toMatchObject({ id: 't1', name: 'echo', definition: {} })
  })

  it('findById returns null when select resolves []', async () => {
    mockDb.select.mockResolvedValueOnce([])
    const repo = makeRepo()
    expect(await repo.findById('missing')).toBeNull()
  })

  it('delete issues DELETE FROM tools WHERE id', async () => {
    const repo = makeRepo()
    await repo.delete('t1')
    expect(mockDb.execute).toHaveBeenCalledWith('DELETE FROM tools WHERE id = $1', ['t1'])
  })
})
