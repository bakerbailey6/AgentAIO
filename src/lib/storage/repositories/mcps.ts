// src/lib/storage/repositories/mcps.ts
import type { Db } from '../db'

export interface McpRow {
  id: string
  name: string
  transport: 'stdio' | 'sse'
  commandOrUrl: string
  envVarsRef: string[]
  enabled: boolean
  createdAt: number
}

interface McpInsert {
  name: string
  transport: 'stdio' | 'sse'
  commandOrUrl: string
  envVarsRef?: string[]
  enabled?: boolean
}

export class McpRepository {
  constructor(private db: Db) {}

  async create(data: McpInsert): Promise<string> {
    const id = crypto.randomUUID()
    await this.db.execute(
      `INSERT INTO mcps (id, name, transport, command_or_url, env_vars_ref, enabled)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        id,
        data.name,
        data.transport,
        data.commandOrUrl,
        JSON.stringify(data.envVarsRef ?? []),
        data.enabled !== undefined ? (data.enabled ? 1 : 0) : 1,
      ],
    )
    return id
  }

  async findAll(): Promise<McpRow[]> {
    const rows = await this.db.select<Record<string, unknown>[]>('SELECT * FROM mcps')
    return rows.map(this.deserialize)
  }

  async findById(id: string): Promise<McpRow | null> {
    const rows = await this.db.select<Record<string, unknown>[]>(
      'SELECT * FROM mcps WHERE id = $1',
      [id],
    )
    return rows[0] ? this.deserialize(rows[0]) : null
  }

  async delete(id: string): Promise<void> {
    await this.db.execute('DELETE FROM mcps WHERE id = $1', [id])
  }

  private deserialize(row: Record<string, unknown>): McpRow {
    return {
      id: row.id as string,
      name: row.name as string,
      transport: row.transport as McpRow['transport'],
      commandOrUrl: row.command_or_url as string,
      envVarsRef: JSON.parse(row.env_vars_ref as string),
      enabled: (row.enabled as number) === 1,
      createdAt: row.created_at as number,
    }
  }
}
