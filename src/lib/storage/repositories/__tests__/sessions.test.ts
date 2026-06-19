import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    execute: vi.fn(async (_sql: string, _params?: unknown[]) => ({ rowsAffected: 1 })),
    select: vi.fn(async () => [] as unknown[]),
  },
}))
vi.mock('@tauri-apps/plugin-sql', () => ({ default: { load: vi.fn(async () => mockDb) } }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => null) }))

import { SessionRepository } from '@/lib/storage/repositories/sessions'

function makeRepo() {
  return new SessionRepository(mockDb as never)
}

describe('SessionRepository', () => {
  beforeEach(() => vi.clearAllMocks())

  it('create issues INSERT INTO sessions with serialized values and returns a uuid', async () => {
    const repo = makeRepo()
    const id = await repo.create({
      agentId: 'a1',
      messages: [{ role: 'user', content: 'hi' }],
      tokenCount: 42,
      costEstimate: 0.5,
    })

    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
    expect(mockDb.execute).toHaveBeenCalledTimes(1)
    const [sql, params] = mockDb.execute.mock.calls[0]
    expect(sql).toContain('INSERT INTO sessions')
    expect(params).toEqual([
      id,
      'a1',
      JSON.stringify([{ role: 'user', content: 'hi' }]),
      42,
      0.5,
    ])
  })

  it('create defaults messages/tokenCount/costEstimate when omitted', async () => {
    const repo = makeRepo()
    const id = await repo.create({ agentId: 'a1' })
    const [, params] = mockDb.execute.mock.calls[0]
    expect(params).toEqual([id, 'a1', '[]', 0, 0])
  })

  it('findAll selects all rows and deserializes snake_case → camelCase', async () => {
    mockDb.select.mockResolvedValueOnce([
      {
        id: 's1',
        agent_id: 'a1',
        messages: '[{"role":"user","content":"hi"}]',
        token_count: 10,
        cost_estimate: 0.25,
        created_at: 1700000000,
      },
    ])
    const repo = makeRepo()
    const rows = await repo.findAll()

    expect(mockDb.select).toHaveBeenCalledWith('SELECT * FROM sessions')
    expect(rows).toEqual([
      {
        id: 's1',
        agentId: 'a1',
        messages: [{ role: 'user', content: 'hi' }],
        tokenCount: 10,
        costEstimate: 0.25,
        createdAt: 1700000000,
      },
    ])
  })

  it('findById returns the deserialized row when present', async () => {
    mockDb.select.mockResolvedValueOnce([
      {
        id: 's1',
        agent_id: 'a1',
        messages: '[]',
        token_count: 0,
        cost_estimate: 0,
        created_at: 0,
      },
    ])
    const repo = makeRepo()
    const row = await repo.findById('s1')

    expect(mockDb.select).toHaveBeenCalledWith('SELECT * FROM sessions WHERE id = $1', ['s1'])
    expect(row).toMatchObject({ id: 's1', agentId: 'a1', messages: [] })
  })

  it('findById returns null when select resolves []', async () => {
    mockDb.select.mockResolvedValueOnce([])
    const repo = makeRepo()
    expect(await repo.findById('missing')).toBeNull()
  })

  it('findByAgentId queries by agent_id ordered by created_at and deserializes', async () => {
    mockDb.select.mockResolvedValueOnce([
      { id: 's1', agent_id: 'a1', messages: '[]', token_count: 0, cost_estimate: 0, created_at: 1 },
    ])
    const repo = makeRepo()
    const rows = await repo.findByAgentId('a1')

    expect(mockDb.select).toHaveBeenCalledWith(
      'SELECT * FROM sessions WHERE agent_id = $1 ORDER BY created_at DESC',
      ['a1'],
    )
    expect(rows[0]).toMatchObject({ id: 's1', agentId: 'a1' })
  })

  it('updateMessages issues UPDATE with JSON.stringify(messages) and id', async () => {
    const repo = makeRepo()
    const messages = [{ role: 'assistant', content: 'ok' }]
    await repo.updateMessages('s1', messages)

    expect(mockDb.execute).toHaveBeenCalledWith(
      'UPDATE sessions SET messages = $1 WHERE id = $2',
      [JSON.stringify(messages), 's1'],
    )
  })

  it('delete issues DELETE FROM sessions WHERE id', async () => {
    const repo = makeRepo()
    await repo.delete('s1')
    expect(mockDb.execute).toHaveBeenCalledWith('DELETE FROM sessions WHERE id = $1', ['s1'])
  })
})
