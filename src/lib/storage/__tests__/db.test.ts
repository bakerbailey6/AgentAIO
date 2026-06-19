import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ALL_MIGRATIONS } from '@/lib/storage/schema'

// db.ts now opens a SQLCipher vault: it keys the DB (passphrase from the OS
// keychain) via the native `vault_open` command BEFORE running migrations, then
// drives migrations through `vault_execute`. We mock the two boundaries — the
// keychain and Tauri's `invoke` — and reset the module between tests so the
// cached `_dbPromise` singleton starts fresh. The hoisted spies survive
// resetModules (the vi.mock factories close over them); we reset them manually.
const { invokeMock, getSecretMock, setSecretMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(async (_cmd: string, _args?: Record<string, unknown>) => undefined as unknown),
  getSecretMock: vi.fn(async (_key: string) => null as string | null),
  setSecretMock: vi.fn(async (_key: string, _value: string) => undefined as void),
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }))
vi.mock('@/lib/keychain', () => ({ getSecret: getSecretMock, setSecret: setSecretMock }))

describe('initDb / encrypted vault bootstrap', () => {
  beforeEach(() => {
    vi.resetModules()
    invokeMock.mockReset()
    invokeMock.mockResolvedValue(undefined)
    getSecretMock.mockReset()
    getSecretMock.mockResolvedValue(null)
    setSecretMock.mockReset()
    setSecretMock.mockResolvedValue(undefined)
  })

  it('on first run generates a passphrase, stores it, keys the DB, then migrates', async () => {
    const { initDb, VAULT_PASSPHRASE_REF } = await import('@/lib/storage/db')
    getSecretMock.mockResolvedValueOnce(null)
    await initDb()

    // A passphrase was generated and persisted to the keychain (not the DB).
    expect(setSecretMock).toHaveBeenCalledTimes(1)
    const [ref, passphrase] = setSecretMock.mock.calls[0]
    expect(ref).toBe(VAULT_PASSPHRASE_REF)
    expect(typeof passphrase).toBe('string')
    expect((passphrase as string).length).toBeGreaterThan(20)

    // The DB was keyed with that passphrase before any migration ran.
    expect(invokeMock).toHaveBeenCalledWith('vault_open', {
      filename: 'acc.db',
      passphrase,
    })
    const openIdx = invokeMock.mock.calls.findIndex((c) => c[0] === 'vault_open')
    const firstExecIdx = invokeMock.mock.calls.findIndex((c) => c[0] === 'vault_execute')
    expect(openIdx).toBeGreaterThanOrEqual(0)
    expect(openIdx).toBeLessThan(firstExecIdx)

    // Every migration ran, in order, via vault_execute.
    const execCalls = invokeMock.mock.calls.filter((c) => c[0] === 'vault_execute')
    expect(execCalls).toHaveLength(ALL_MIGRATIONS.length)
    ALL_MIGRATIONS.forEach((sql, i) => {
      expect(execCalls[i][1]).toEqual({ query: sql, values: [] })
    })
  })

  it('reuses an existing keychain passphrase and never re-stores one', async () => {
    const { initDb } = await import('@/lib/storage/db')
    getSecretMock.mockResolvedValueOnce('existing-passphrase')
    await initDb()

    expect(setSecretMock).not.toHaveBeenCalled()
    expect(invokeMock).toHaveBeenCalledWith('vault_open', {
      filename: 'acc.db',
      passphrase: 'existing-passphrase',
    })
  })

  it('caches the singleton: a second initDb does not reopen or re-migrate', async () => {
    const { initDb } = await import('@/lib/storage/db')
    getSecretMock.mockResolvedValue('p')
    const db1 = await initDb()
    const db2 = await initDb()

    expect(db1).toBe(db2)
    expect(invokeMock.mock.calls.filter((c) => c[0] === 'vault_open')).toHaveLength(1)
    expect(invokeMock.mock.calls.filter((c) => c[0] === 'vault_execute')).toHaveLength(
      ALL_MIGRATIONS.length,
    )
  })

  it('the returned handle forwards select/execute to the vault commands', async () => {
    const { initDb } = await import('@/lib/storage/db')
    getSecretMock.mockResolvedValue('p')
    const db = await initDb()

    invokeMock.mockResolvedValueOnce([{ id: '1' }])
    const rows = await db.select('SELECT * FROM t WHERE id = $1', ['1'])
    expect(invokeMock).toHaveBeenCalledWith('vault_select', {
      query: 'SELECT * FROM t WHERE id = $1',
      values: ['1'],
    })
    expect(rows).toEqual([{ id: '1' }])

    await db.execute('DELETE FROM t WHERE id = $1', ['1'])
    expect(invokeMock).toHaveBeenCalledWith('vault_execute', {
      query: 'DELETE FROM t WHERE id = $1',
      values: ['1'],
    })
  })

  it('clears the cache on unlock failure so a later call can retry', async () => {
    const { initDb } = await import('@/lib/storage/db')
    getSecretMock.mockResolvedValue('p')
    invokeMock.mockImplementationOnce(async () => {
      throw new Error('vault is not open')
    })
    await expect(initDb()).rejects.toThrow('vault is not open')

    // Retry succeeds (cache was cleared).
    invokeMock.mockResolvedValue(undefined)
    await expect(initDb()).resolves.toBeDefined()
    expect(invokeMock.mock.calls.filter((c) => c[0] === 'vault_open')).toHaveLength(2)
  })
})
