// src/lib/storage/repositories/agents.ts
import type { Db } from '../db'

export interface AgentRow {
  id: string
  name: string
  type: 'llm' | 'coding-agent' | 'custom'
  modelId: string | null
  systemPrompt: string
  toolIds: string[]
  mcpIds: string[]
  canvasX: number
  canvasY: number
  groupId: string | null
  createdAt: number
}

interface AgentInsert {
  name: string
  type: 'llm' | 'coding-agent' | 'custom'
  modelId?: string | null
  systemPrompt?: string
  toolIds?: string[]
  mcpIds?: string[]
  canvasX?: number
  canvasY?: number
  groupId?: string | null
}

export class AgentRepository {
  constructor(private db: Db) {}

  async create(data: AgentInsert): Promise<string> {
    const id = crypto.randomUUID()
    await this.db.execute(
      `INSERT INTO agents (id, name, type, model_id, system_prompt, tool_ids, mcp_ids, canvas_x, canvas_y, group_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        data.name,
        data.type ?? 'llm',
        data.modelId ?? null,
        data.systemPrompt ?? '',
        JSON.stringify(data.toolIds ?? []),
        JSON.stringify(data.mcpIds ?? []),
        data.canvasX ?? 0,
        data.canvasY ?? 0,
        data.groupId ?? null,
      ],
    )
    return id
  }

  async findAll(): Promise<AgentRow[]> {
    const rows = await this.db.select<Record<string, unknown>[]>('SELECT * FROM agents')
    return rows.map(this.deserialize)
  }

  async findById(id: string): Promise<AgentRow | null> {
    const rows = await this.db.select<Record<string, unknown>[]>(
      'SELECT * FROM agents WHERE id = $1',
      [id],
    )
    return rows[0] ? this.deserialize(rows[0]) : null
  }

  async updatePosition(id: string, x: number, y: number): Promise<void> {
    await this.db.execute(
      'UPDATE agents SET canvas_x = $1, canvas_y = $2 WHERE id = $3',
      [x, y, id],
    )
  }

  async delete(id: string): Promise<void> {
    await this.db.execute('DELETE FROM agents WHERE id = $1', [id])
  }

  private deserialize(row: Record<string, unknown>): AgentRow {
    return {
      id: row.id as string,
      name: row.name as string,
      type: row.type as AgentRow['type'],
      modelId: row.model_id as string | null,
      systemPrompt: row.system_prompt as string,
      toolIds: JSON.parse(row.tool_ids as string),
      mcpIds: JSON.parse(row.mcp_ids as string),
      canvasX: row.canvas_x as number,
      canvasY: row.canvas_y as number,
      groupId: row.group_id as string | null,
      createdAt: row.created_at as number,
    }
  }
}
