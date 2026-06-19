/**
 * Repository for the `workflows` table — saved Workflow Builder graphs.
 *
 * Owns all SQL for workflows and (de)serializes the JSON `nodes` / `edges`
 * columns into arrays. Mirrors {@link AgentRepository}; `update` builds its SET
 * clause dynamically in a fixed column order and always bumps `updated_at`.
 *
 * @module
 */
import type { Db } from '../db'

/** A workflow as stored, with JSON columns already parsed. */
export interface WorkflowRow {
  id: string
  name: string
  description: string
  nodes: unknown[]
  edges: unknown[]
  createdAt: number
  updatedAt: number
}

interface WorkflowInsert {
  name: string
  description?: string
  nodes?: unknown[]
  edges?: unknown[]
}

export class WorkflowRepository {
  constructor(private db: Db) {}

  /** Insert a new workflow and return its generated id. */
  async create(data: WorkflowInsert): Promise<string> {
    const id = crypto.randomUUID()
    await this.db.execute(
      `INSERT INTO workflows (id, name, description, nodes, edges)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        id,
        data.name,
        data.description ?? '',
        JSON.stringify(data.nodes ?? []),
        JSON.stringify(data.edges ?? []),
      ],
    )
    return id
  }

  /** Return every workflow, most recently updated first. */
  async findAll(): Promise<WorkflowRow[]> {
    const rows = await this.db.select<Record<string, unknown>[]>(
      'SELECT * FROM workflows ORDER BY updated_at DESC',
    )
    return rows.map(this.deserialize)
  }

  /** Return one workflow by id, or `null` if it doesn't exist. */
  async findById(id: string): Promise<WorkflowRow | null> {
    const rows = await this.db.select<Record<string, unknown>[]>(
      'SELECT * FROM workflows WHERE id = $1',
      [id],
    )
    return rows[0] ? this.deserialize(rows[0]) : null
  }

  /**
   * Patch a workflow's editable fields. Builds the SET clause from the provided
   * keys in a fixed column order (`name`, `description`, `nodes`, `edges`) so the
   * positional params are deterministic, and always bumps `updated_at`. A no-op
   * (empty patch) issues no SQL.
   */
  async update(
    id: string,
    patch: { name?: string; description?: string; nodes?: unknown[]; edges?: unknown[] },
  ): Promise<void> {
    const sets: string[] = []
    const params: unknown[] = []
    if ('name' in patch) {
      sets.push(`name = $${params.length + 1}`)
      params.push(patch.name)
    }
    if ('description' in patch) {
      sets.push(`description = $${params.length + 1}`)
      params.push(patch.description)
    }
    if ('nodes' in patch) {
      sets.push(`nodes = $${params.length + 1}`)
      params.push(JSON.stringify(patch.nodes))
    }
    if ('edges' in patch) {
      sets.push(`edges = $${params.length + 1}`)
      params.push(JSON.stringify(patch.edges))
    }
    if (sets.length === 0) return
    sets.push('updated_at = unixepoch()')
    params.push(id)
    await this.db.execute(
      `UPDATE workflows SET ${sets.join(', ')} WHERE id = $${params.length}`,
      params,
    )
  }

  /** Delete a workflow (its runs cascade away via the FK). */
  async delete(id: string): Promise<void> {
    await this.db.execute('DELETE FROM workflows WHERE id = $1', [id])
  }

  /** Map a raw snake_case DB row to a {@link WorkflowRow}, parsing JSON columns. */
  private deserialize(row: Record<string, unknown>): WorkflowRow {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string,
      nodes: JSON.parse(row.nodes as string),
      edges: JSON.parse(row.edges as string),
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    }
  }
}
