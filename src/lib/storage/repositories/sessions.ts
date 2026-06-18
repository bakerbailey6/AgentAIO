// src/lib/storage/repositories/sessions.ts
import type { Db } from '../db'

export interface SessionRow {
  id: string
  agentId: string
  messages: unknown[]
  tokenCount: number
  costEstimate: number
  createdAt: number
}

interface SessionInsert {
  agentId: string
  messages?: unknown[]
  tokenCount?: number
  costEstimate?: number
}

export class SessionRepository {
  constructor(private db: Db) {}

  async create(data: SessionInsert): Promise<string> {
    const id = crypto.randomUUID()
    await this.db.execute(
      `INSERT INTO sessions (id, agent_id, messages, token_count, cost_estimate)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        id,
        data.agentId,
        JSON.stringify(data.messages ?? []),
        data.tokenCount ?? 0,
        data.costEstimate ?? 0,
      ],
    )
    return id
  }

  async findAll(): Promise<SessionRow[]> {
    const rows = await this.db.select<Record<string, unknown>[]>('SELECT * FROM sessions')
    return rows.map(this.deserialize)
  }

  async findById(id: string): Promise<SessionRow | null> {
    const rows = await this.db.select<Record<string, unknown>[]>(
      'SELECT * FROM sessions WHERE id = $1',
      [id],
    )
    return rows[0] ? this.deserialize(rows[0]) : null
  }

  async delete(id: string): Promise<void> {
    await this.db.execute('DELETE FROM sessions WHERE id = $1', [id])
  }

  private deserialize(row: Record<string, unknown>): SessionRow {
    return {
      id: row.id as string,
      agentId: row.agent_id as string,
      messages: JSON.parse(row.messages as string),
      tokenCount: row.token_count as number,
      costEstimate: row.cost_estimate as number,
      createdAt: row.created_at as number,
    }
  }
}
