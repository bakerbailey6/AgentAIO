import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    execute: vi.fn(async (_sql: string, _params?: unknown[]) => ({ rowsAffected: 1 })),
    select: vi.fn(async () => [] as unknown[]),
  },
}))
vi.mock('@tauri-apps/plugin-sql', () => ({ default: { load: vi.fn(async () => mockDb) } }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => null) }))

import { ModelRepository } from '@/lib/storage/repositories/models'

function makeRepo() {
  return new ModelRepository(mockDb as never)
}

describe('ModelRepository', () => {
  beforeEach(() => vi.clearAllMocks())

  it('create issues INSERT INTO models with all fields and returns a uuid', async () => {
    const repo = makeRepo()
    const id = await repo.create({
      provider: 'anthropic',
      modelName: 'claude-opus-4-8',
      displayName: 'Opus 4.8',
      apiKeyRef: 'anthropic-key',
      baseUrl: 'https://api.anthropic.com',
    })

    expect(typeof id).toBe('string')
    const [sql, params] = mockDb.execute.mock.calls[0]
    expect(sql).toContain('INSERT INTO models')
    expect(params).toEqual([
      id,
      'anthropic',
      'claude-opus-4-8',
      'Opus 4.8',
      'anthropic-key',
      'https://api.anthropic.com',
    ])
  })

  it('create defaults apiKeyRef and baseUrl to null when omitted', async () => {
    const repo = makeRepo()
    const id = await repo.create({
      provider: 'ollama',
      modelName: 'llama3',
      displayName: 'Llama 3',
    })
    const [, params] = mockDb.execute.mock.calls[0]
    expect(params).toEqual([id, 'ollama', 'llama3', 'Llama 3', null, null])
  })

  it('findAll selects all rows and maps snake_case → camelCase', async () => {
    mockDb.select.mockResolvedValueOnce([
      {
        id: 'm1',
        provider: 'openai',
        model_name: 'gpt-4',
        display_name: 'GPT-4',
        api_key_ref: 'openai-key',
        base_url: null,
        created_at: 123,
      },
    ])
    const repo = makeRepo()
    const rows = await repo.findAll()

    expect(mockDb.select).toHaveBeenCalledWith('SELECT * FROM models')
    expect(rows).toEqual([
      {
        id: 'm1',
        provider: 'openai',
        modelName: 'gpt-4',
        displayName: 'GPT-4',
        apiKeyRef: 'openai-key',
        baseUrl: null,
        createdAt: 123,
      },
    ])
  })

  it('findById returns the deserialized row when present', async () => {
    mockDb.select.mockResolvedValueOnce([
      {
        id: 'm1',
        provider: 'openai',
        model_name: 'gpt-4',
        display_name: 'GPT-4',
        api_key_ref: null,
        base_url: null,
        created_at: 0,
      },
    ])
    const repo = makeRepo()
    const row = await repo.findById('m1')

    expect(mockDb.select).toHaveBeenCalledWith('SELECT * FROM models WHERE id = $1', ['m1'])
    expect(row).toMatchObject({ id: 'm1', provider: 'openai', modelName: 'gpt-4' })
  })

  it('findById returns null when select resolves []', async () => {
    mockDb.select.mockResolvedValueOnce([])
    const repo = makeRepo()
    expect(await repo.findById('missing')).toBeNull()
  })

  it('delete issues DELETE FROM models WHERE id', async () => {
    const repo = makeRepo()
    await repo.delete('m1')
    expect(mockDb.execute).toHaveBeenCalledWith('DELETE FROM models WHERE id = $1', ['m1'])
  })
})
