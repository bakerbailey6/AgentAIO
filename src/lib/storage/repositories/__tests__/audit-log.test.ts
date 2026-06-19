import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    execute: vi.fn(async (_sql: string, _params?: unknown[]) => ({ rowsAffected: 1 })),
    select: vi.fn(async () => [] as unknown[]),
  },
}))
vi.mock('@tauri-apps/plugin-sql', () => ({ default: { load: vi.fn(async () => mockDb) } }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => null) }))

import { AuditLogRepository } from '@/lib/storage/repositories/audit-log'

function makeRepo() {
  return new AuditLogRepository(mockDb as never)
}

describe('AuditLogRepository', () => {
  beforeEach(() => vi.clearAllMocks())

  it('append issues INSERT INTO audit_log and JSON-encodes payload', async () => {
    const repo = makeRepo()
    const payload = { tool: 'search', query: 'cats' }
    await repo.append({
      agentId: 'a1',
      actionType: 'tool-call',
      payload,
      approvedBy: 'user',
    })

    const [sql, params] = mockDb.execute.mock.calls[0]
    expect(sql).toContain('INSERT INTO audit_log')
    expect(params).toEqual(['a1', 'tool-call', JSON.stringify(payload), 'user'])
  })

  it('append defaults approvedBy to null when omitted', async () => {
    const repo = makeRepo()
    await repo.append({ agentId: 'a1', actionType: 'status-change', payload: {} })
    const [, params] = mockDb.execute.mock.calls[0]
    expect(params).toEqual(['a1', 'status-change', '{}', null])
  })

  it('findByAgent queries by agent_id with default limit 50 and JSON-parses payload', async () => {
    mockDb.select.mockResolvedValueOnce([
      {
        agent_id: 'a1',
        action_type: 'tool-call',
        payload: '{"tool":"search"}',
        approved_by: 'user',
        timestamp: 5,
      },
    ])
    const repo = makeRepo()
    const entries = await repo.findByAgent('a1')

    expect(mockDb.select).toHaveBeenCalledWith(
      'SELECT * FROM audit_log WHERE agent_id = $1 ORDER BY timestamp DESC LIMIT $2',
      ['a1', 50],
    )
    expect(entries).toEqual([
      {
        agentId: 'a1',
        actionType: 'tool-call',
        payload: { tool: 'search' },
        approvedBy: 'user',
      },
    ])
  })

  it('findByAgent respects an explicit limit param', async () => {
    mockDb.select.mockResolvedValueOnce([])
    const repo = makeRepo()
    await repo.findByAgent('a1', 5)

    expect(mockDb.select).toHaveBeenCalledWith(
      'SELECT * FROM audit_log WHERE agent_id = $1 ORDER BY timestamp DESC LIMIT $2',
      ['a1', 5],
    )
  })

  it('findByAgent returns [] when select resolves []', async () => {
    mockDb.select.mockResolvedValueOnce([])
    const repo = makeRepo()
    expect(await repo.findByAgent('a1')).toEqual([])
  })
})
