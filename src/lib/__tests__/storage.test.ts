import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock tauri plugin-sql
const mockDb = {
  execute: vi.fn(async () => ({ rowsAffected: 1 })),
  select: vi.fn(async () => []),
}
vi.mock('@tauri-apps/plugin-sql', () => ({
  default: { load: vi.fn(async () => mockDb) },
}))

import { initDb } from '@/lib/storage/db'
import { AgentRepository } from '@/lib/storage/repositories/agents'

describe('AgentRepository', () => {
  beforeEach(() => vi.clearAllMocks())

  it('create calls execute with INSERT', async () => {
    const db = await initDb()
    const repo = new AgentRepository(db)
    await repo.create({
      name: 'Coder',
      type: 'llm',
      modelId: 'model-1',
      systemPrompt: 'You are a coder',
      toolIds: [],
      mcpIds: [],
      canvasX: 100,
      canvasY: 200,
      groupId: null,
    })
    expect(mockDb.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO agents'),
      expect.any(Array),
    )
  })

  it('findAll calls SELECT', async () => {
    const db = await initDb()
    const repo = new AgentRepository(db)
    await repo.findAll()
    expect(mockDb.select).toHaveBeenCalledWith(
      expect.stringContaining('SELECT * FROM agents'),
    )
  })
})
