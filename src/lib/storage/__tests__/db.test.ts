import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ALL_MIGRATIONS } from '@/lib/storage/schema'

// `db.ts` holds a module-level `_db` singleton. We reset the module registry in
// beforeEach (via vi.resetModules) and re-import `initDb` per test so the
// singleton starts null each time. The hoisted `loadMock` spy is stable across
// resetModules (the vi.mock factory closes over it), so we clear it manually.
const { mockDb, loadMock } = vi.hoisted(() => {
  const mockDb = {
    execute: vi.fn(async () => ({ rowsAffected: 1 })),
    select: vi.fn(async () => [] as unknown[]),
  }
  return { mockDb, loadMock: vi.fn(async () => mockDb) }
})
vi.mock('@tauri-apps/plugin-sql', () => ({ default: { load: loadMock } }))

describe('initDb / migration runner', () => {
  beforeEach(() => {
    vi.resetModules()
    loadMock.mockClear()
    mockDb.execute.mockClear()
  })

  it('loads the sqlite db and runs every migration once on first init', async () => {
    const { initDb } = await import('@/lib/storage/db')
    await initDb()

    expect(loadMock).toHaveBeenCalledTimes(1)
    expect(loadMock).toHaveBeenCalledWith('sqlite:acc.db')
    expect(mockDb.execute).toHaveBeenCalledTimes(ALL_MIGRATIONS.length)
    ALL_MIGRATIONS.forEach((sql, i) => {
      expect(mockDb.execute).toHaveBeenNthCalledWith(i + 1, sql)
    })
  })

  it('caches the singleton: a second initDb returns the same db without reloading or re-migrating', async () => {
    const { initDb } = await import('@/lib/storage/db')
    const db1 = await initDb()
    const db2 = await initDb()

    expect(db1).toBe(db2)
    expect(loadMock).toHaveBeenCalledTimes(1)
    expect(mockDb.execute).toHaveBeenCalledTimes(ALL_MIGRATIONS.length)
  })
})
