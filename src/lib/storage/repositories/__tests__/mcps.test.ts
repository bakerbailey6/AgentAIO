import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    execute: vi.fn(async (_sql: string, _params?: unknown[]) => ({ rowsAffected: 1 })),
    select: vi.fn(async () => [] as unknown[]),
  },
}))
vi.mock('@tauri-apps/plugin-sql', () => ({ default: { load: vi.fn(async () => mockDb) } }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => null) }))

import { McpRepository } from '@/lib/storage/repositories/mcps'

function makeRepo() {
  return new McpRepository(mockDb as never)
}

describe('McpRepository', () => {
  beforeEach(() => vi.clearAllMocks())

  it('create issues INSERT INTO mcps, JSON-encodes envVarsRef, and maps enabled→1', async () => {
    const repo = makeRepo()
    const id = await repo.create({
      name: 'filesystem',
      transport: 'stdio',
      commandOrUrl: 'npx mcp-fs',
      envVarsRef: ['PATH', 'HOME'],
      enabled: true,
    })

    expect(typeof id).toBe('string')
    const [sql, params] = mockDb.execute.mock.calls[0]
    expect(sql).toContain('INSERT INTO mcps')
    expect(params).toEqual([id, 'filesystem', 'stdio', 'npx mcp-fs', JSON.stringify(['PATH', 'HOME']), 1])
  })

  it('create maps enabled=false → 0', async () => {
    const repo = makeRepo()
    const id = await repo.create({
      name: 'sse-server',
      transport: 'sse',
      commandOrUrl: 'https://example.com/sse',
      enabled: false,
    })
    const [, params] = mockDb.execute.mock.calls[0]
    expect(params).toEqual([id, 'sse-server', 'sse', 'https://example.com/sse', '[]', 0])
  })

  it('create defaults envVarsRef to [] and enabled to 1 when omitted', async () => {
    const repo = makeRepo()
    const id = await repo.create({
      name: 'default',
      transport: 'stdio',
      commandOrUrl: 'cmd',
    })
    const [, params] = mockDb.execute.mock.calls[0]
    expect(params).toEqual([id, 'default', 'stdio', 'cmd', '[]', 1])
  })

  it('findAll maps snake_case → camelCase, parses env_vars_ref, and coerces enabled→boolean', async () => {
    mockDb.select.mockResolvedValueOnce([
      {
        id: 'mcp1',
        name: 'filesystem',
        transport: 'stdio',
        command_or_url: 'npx mcp-fs',
        env_vars_ref: '["PATH"]',
        enabled: 1,
        created_at: 99,
      },
    ])
    const repo = makeRepo()
    const rows = await repo.findAll()

    expect(mockDb.select).toHaveBeenCalledWith('SELECT * FROM mcps')
    expect(rows).toEqual([
      {
        id: 'mcp1',
        name: 'filesystem',
        transport: 'stdio',
        commandOrUrl: 'npx mcp-fs',
        envVarsRef: ['PATH'],
        enabled: true,
        createdAt: 99,
      },
    ])
  })

  it('findAll coerces enabled=0 → false', async () => {
    mockDb.select.mockResolvedValueOnce([
      {
        id: 'mcp1',
        name: 'x',
        transport: 'sse',
        command_or_url: 'u',
        env_vars_ref: '[]',
        enabled: 0,
        created_at: 0,
      },
    ])
    const repo = makeRepo()
    const rows = await repo.findAll()
    expect(rows[0].enabled).toBe(false)
  })

  it('findById returns null when select resolves []', async () => {
    mockDb.select.mockResolvedValueOnce([])
    const repo = makeRepo()
    expect(await repo.findById('missing')).toBeNull()
  })

  it('delete issues DELETE FROM mcps WHERE id', async () => {
    const repo = makeRepo()
    await repo.delete('mcp1')
    expect(mockDb.execute).toHaveBeenCalledWith('DELETE FROM mcps WHERE id = $1', ['mcp1'])
  })
})
