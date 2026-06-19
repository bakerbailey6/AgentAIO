import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    execute: vi.fn(async (_sql: string, _params?: unknown[]) => ({ rowsAffected: 1 })),
    select: vi.fn(async () => [] as unknown[]),
  },
}))
vi.mock('@tauri-apps/plugin-sql', () => ({ default: { load: vi.fn(async () => mockDb) } }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => null) }))

import { WorkflowRepository } from '@/lib/storage/repositories/workflows'

function makeRepo() {
  return new WorkflowRepository(mockDb as never)
}

describe('WorkflowRepository', () => {
  beforeEach(() => vi.clearAllMocks())

  it('create issues INSERT INTO workflows and JSON-encodes nodes / edges', async () => {
    const repo = makeRepo()
    const nodes = [{ id: 'n1' }]
    const edges = [{ from: 'n1', to: 'n2' }]
    const id = await repo.create({ name: 'wf', description: 'desc', nodes, edges })

    expect(typeof id).toBe('string')
    const [sql, params] = mockDb.execute.mock.calls[0]
    expect(sql).toContain('INSERT INTO workflows')
    expect(sql).toContain('(id, name, description, nodes, edges)')
    expect(sql).toContain('VALUES ($1, $2, $3, $4, $5)')
    expect(params).toEqual([id, 'wf', 'desc', JSON.stringify(nodes), JSON.stringify(edges)])
  })

  it('create defaults description to "" and nodes / edges to [] when omitted', async () => {
    const repo = makeRepo()
    const id = await repo.create({ name: 'minimal' })
    const [, params] = mockDb.execute.mock.calls[0]
    expect(params).toEqual([id, 'minimal', '', '[]', '[]'])
  })

  it('findAll selects ordered by updated_at DESC and maps snake_case → camelCase', async () => {
    mockDb.select.mockResolvedValueOnce([
      {
        id: 'wf1',
        name: 'My Flow',
        description: 'd',
        nodes: '[{"id":"n1"}]',
        edges: '[{"from":"n1","to":"n2"}]',
        created_at: 100,
        updated_at: 200,
      },
    ])
    const repo = makeRepo()
    const rows = await repo.findAll()

    expect(mockDb.select).toHaveBeenCalledWith('SELECT * FROM workflows ORDER BY updated_at DESC')
    expect(rows).toEqual([
      {
        id: 'wf1',
        name: 'My Flow',
        description: 'd',
        nodes: [{ id: 'n1' }],
        edges: [{ from: 'n1', to: 'n2' }],
        createdAt: 100,
        updatedAt: 200,
      },
    ])
  })

  it('findById returns the deserialized row when found', async () => {
    mockDb.select.mockResolvedValueOnce([
      {
        id: 'wf1',
        name: 'X',
        description: '',
        nodes: '[]',
        edges: '[]',
        created_at: 1,
        updated_at: 2,
      },
    ])
    const repo = makeRepo()
    const row = await repo.findById('wf1')
    expect(mockDb.select).toHaveBeenCalledWith('SELECT * FROM workflows WHERE id = $1', ['wf1'])
    expect(row).toEqual({
      id: 'wf1',
      name: 'X',
      description: '',
      nodes: [],
      edges: [],
      createdAt: 1,
      updatedAt: 2,
    })
  })

  it('findById returns null when select resolves []', async () => {
    mockDb.select.mockResolvedValueOnce([])
    const repo = makeRepo()
    expect(await repo.findById('missing')).toBeNull()
  })

  it('update issues a single-column UPDATE for a name-only patch and always bumps updated_at', async () => {
    const repo = makeRepo()
    await repo.update('wf1', { name: 'Renamed' })
    expect(mockDb.execute).toHaveBeenCalledWith(
      'UPDATE workflows SET name = $1, updated_at = unixepoch() WHERE id = $2',
      ['Renamed', 'wf1'],
    )
  })

  it('update builds SET clauses in fixed column order and JSON-encodes nodes / edges', async () => {
    const repo = makeRepo()
    const nodes = [{ id: 'n1' }]
    const edges = [{ from: 'a', to: 'b' }]
    await repo.update('wf1', { name: 'X', description: 'Y', nodes, edges })
    expect(mockDb.execute).toHaveBeenCalledWith(
      'UPDATE workflows SET name = $1, description = $2, nodes = $3, edges = $4, updated_at = unixepoch() WHERE id = $5',
      ['X', 'Y', JSON.stringify(nodes), JSON.stringify(edges), 'wf1'],
    )
  })

  it('update issues no SQL for an empty patch', async () => {
    const repo = makeRepo()
    await repo.update('wf1', {})
    expect(mockDb.execute).not.toHaveBeenCalled()
  })

  it('delete issues DELETE FROM workflows WHERE id', async () => {
    const repo = makeRepo()
    await repo.delete('wf1')
    expect(mockDb.execute).toHaveBeenCalledWith('DELETE FROM workflows WHERE id = $1', ['wf1'])
  })
})
