/**
 * Persistence for canvas layout: the viewport, group definitions, and per-agent
 * positions. Canvas state lives in a single-row `canvas_state` table (id = 1),
 * upserted on change; agent positions are written straight onto the `agents`
 * rows so they survive reloads.
 *
 * @module
 */
import { initDb } from '@/lib/storage'
import type { Viewport } from 'reactflow'

/** Upsert the singleton canvas-state row with the current viewport and groups. */
export async function saveCanvasState(viewport: Viewport, groups: unknown[]): Promise<void> {
  const db = await initDb()
  await db.execute(
    `INSERT INTO canvas_state (id, viewport_x, viewport_y, zoom, group_definitions)
     VALUES (1, $1, $2, $3, $4)
     ON CONFLICT(id) DO UPDATE SET viewport_x=$1, viewport_y=$2, zoom=$3, group_definitions=$4`,
    [viewport.x, viewport.y, viewport.zoom, JSON.stringify(groups)],
  )
}

/** Load the saved canvas state, or `null` if nothing has been saved yet. */
export async function loadCanvasState(): Promise<{ viewport: Viewport; groups: unknown[] } | null> {
  const db = await initDb()
  const rows = await db.select<Array<Record<string, unknown>>>('SELECT * FROM canvas_state WHERE id = 1')
  if (!rows[0]) return null
  const r = rows[0]
  return {
    viewport: { x: r.viewport_x as number, y: r.viewport_y as number, zoom: r.zoom as number },
    groups: JSON.parse(r.group_definitions as string),
  }
}

/** Persist a single agent's canvas position after a drag. */
export async function saveAgentPosition(agentId: string, x: number, y: number): Promise<void> {
  const db = await initDb()
  await db.execute('UPDATE agents SET canvas_x = $1, canvas_y = $2 WHERE id = $3', [x, y, agentId])
}
