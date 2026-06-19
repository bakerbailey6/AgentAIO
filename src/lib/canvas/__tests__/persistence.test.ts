import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    execute: vi.fn(async (_sql: string, _params?: unknown[]) => ({ rowsAffected: 1 })),
    select: vi.fn(async () => [] as unknown[]),
  },
}))
// persistence.ts pulls `initDb` from the storage barrel, not a passed-in db.
vi.mock('@/lib/storage', () => ({ initDb: vi.fn(async () => mockDb) }))

import { saveCanvasState, loadCanvasState, saveAgentPosition } from '@/lib/canvas/persistence'

const viewport = { x: 10, y: 20, zoom: 1.5 }

describe('canvas persistence', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('saveCanvasState', () => {
    it('upserts canvas_state with viewport fields and JSON-encoded groups', async () => {
      const groups = [{ id: 'g1', label: 'Group 1' }]
      await saveCanvasState(viewport, groups)

      const [sql, params] = mockDb.execute.mock.calls[0]
      expect(sql).toContain('INSERT INTO canvas_state')
      expect(sql).toContain('ON CONFLICT(id) DO UPDATE SET')
      expect(params).toEqual([10, 20, 1.5, JSON.stringify(groups)])
    })
  })

  describe('loadCanvasState', () => {
    it('queries the singleton row id = 1', async () => {
      mockDb.select.mockResolvedValueOnce([])
      await loadCanvasState()
      expect(mockDb.select).toHaveBeenCalledWith('SELECT * FROM canvas_state WHERE id = 1')
    })

    it('returns null when no row exists', async () => {
      mockDb.select.mockResolvedValueOnce([])
      expect(await loadCanvasState()).toBeNull()
    })

    it('returns the parsed viewport and groups when a row exists', async () => {
      mockDb.select.mockResolvedValueOnce([
        {
          id: 1,
          viewport_x: 100,
          viewport_y: 200,
          zoom: 0.75,
          group_definitions: '[{"id":"g1"}]',
        },
      ])
      const result = await loadCanvasState()
      expect(result).toEqual({
        viewport: { x: 100, y: 200, zoom: 0.75 },
        groups: [{ id: 'g1' }],
      })
    })
  })

  describe('saveAgentPosition', () => {
    it('issues UPDATE agents SET canvas_x/canvas_y WHERE id', async () => {
      await saveAgentPosition('a1', 5, 6)
      expect(mockDb.execute).toHaveBeenCalledWith(
        'UPDATE agents SET canvas_x = $1, canvas_y = $2 WHERE id = $3',
        [5, 6, 'a1'],
      )
    })
  })
})
