/**
 * Repository for the `tools` table — installed tool definitions. `definition`
 * holds the tool's JSON Schema (see {@link ToolDefinition}); `source` records
 * whether it is built-in, registry-installed, or custom. See
 * {@link AgentRepository} for the pattern.
 *
 * @module
 */
import type { Db } from '../db'

export interface ToolRow {
  id: string
  name: string
  description: string
  source: 'built-in' | 'registry' | 'custom'
  version: string
  definition: Record<string, unknown>
  createdAt: number
}

interface ToolInsert {
  name: string
  description: string
  source: 'built-in' | 'registry' | 'custom'
  version?: string
  definition?: Record<string, unknown>
}

export class ToolRepository {
  constructor(private db: Db) {}

  async create(data: ToolInsert): Promise<string> {
    const id = crypto.randomUUID()
    await this.db.execute(
      `INSERT INTO tools (id, name, description, source, version, definition)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        id,
        data.name,
        data.description,
        data.source,
        data.version ?? '1.0.0',
        JSON.stringify(data.definition ?? {}),
      ],
    )
    return id
  }

  async findAll(): Promise<ToolRow[]> {
    const rows = await this.db.select<Record<string, unknown>[]>('SELECT * FROM tools')
    return rows.map(this.deserialize)
  }

  async findById(id: string): Promise<ToolRow | null> {
    const rows = await this.db.select<Record<string, unknown>[]>(
      'SELECT * FROM tools WHERE id = $1',
      [id],
    )
    return rows[0] ? this.deserialize(rows[0]) : null
  }

  async delete(id: string): Promise<void> {
    await this.db.execute('DELETE FROM tools WHERE id = $1', [id])
  }

  private deserialize(row: Record<string, unknown>): ToolRow {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string,
      source: row.source as ToolRow['source'],
      version: row.version as string,
      definition: JSON.parse(row.definition as string),
      createdAt: row.created_at as number,
    }
  }
}
