import { describe, it, expect, beforeEach, vi } from 'vitest'

// AgentRepository goes through the encrypted-vault Db handle, which forwards to
// the native `vault_execute`/`vault_select` commands. Mock the keychain + invoke
// boundaries; the repository SQL itself is what we assert.
const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(async () => [] as unknown),
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }))
vi.mock('@/lib/keychain', () => ({
  getSecret: vi.fn(async () => 'passphrase'),
  setSecret: vi.fn(async () => undefined),
}))

import { initDb } from '@/lib/storage/db'
import { AgentRepository } from '@/lib/storage/repositories/agents'

describe('AgentRepository (through the vault Db handle)', () => {
  beforeEach(() => {
    invokeMock.mockReset()
    invokeMock.mockResolvedValue([])
  })

  it('create issues vault_execute with an INSERT INTO agents', async () => {
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
    expect(invokeMock).toHaveBeenCalledWith(
      'vault_execute',
      expect.objectContaining({
        query: expect.stringContaining('INSERT INTO agents'),
        values: expect.any(Array),
      }),
    )
  })

  it('findAll issues vault_select against the agents table', async () => {
    const db = await initDb()
    const repo = new AgentRepository(db)
    await repo.findAll()
    expect(invokeMock).toHaveBeenCalledWith(
      'vault_select',
      expect.objectContaining({ query: expect.stringContaining('SELECT * FROM agents') }),
    )
  })
})
