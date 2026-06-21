/**
 * Repository for the `agents` table.
 *
 * Owns all SQL for agents and converts between snake_case database rows and the
 * camelCase {@link AgentRow} used by the app, parsing the JSON `tool_ids` /
 * `mcp_ids` columns into arrays. This is the canonical example of the
 * repository pattern the other tables follow.
 *
 * @module
 */
import type { Db } from '../db'

/** An agent as stored, with JSON columns already parsed. */
export interface AgentRow {
  id: string
  name: string
  type: 'llm' | 'coding-agent' | 'custom'
  modelId: string | null
  systemPrompt: string
  /** Working directory for coding-agent runtimes (Claude Code / Codex). */
  projectDirectory: string | null
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
  projectDirectory?: string | null
  toolIds?: string[]
  mcpIds?: string[]
  canvasX?: number
  canvasY?: number
  groupId?: string | null
}

export class AgentRepository {
  constructor(private db: Db) {}

  /** Insert a new agent and return its generated id. */
  async create(data: AgentInsert): Promise<string> {
    const id = crypto.randomUUID()
    await this.db.execute(
      `INSERT INTO agents (id, name, type, model_id, system_prompt, project_directory, tool_ids, mcp_ids, canvas_x, canvas_y, group_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id,
        data.name,
        data.type ?? 'llm',
        data.modelId ?? null,
        data.systemPrompt ?? '',
        data.projectDirectory ?? null,
        JSON.stringify(data.toolIds ?? []),
        JSON.stringify(data.mcpIds ?? []),
        data.canvasX ?? 0,
        data.canvasY ?? 0,
        data.groupId ?? null,
      ],
    )
    return id
  }

  /** Return every agent. */
  async findAll(): Promise<AgentRow[]> {
    const rows = await this.db.select<Record<string, unknown>[]>('SELECT * FROM agents')
    return rows.map(this.deserialize)
  }

  /** Return one agent by id, or `null` if it doesn't exist. */
  async findById(id: string): Promise<AgentRow | null> {
    const rows = await this.db.select<Record<string, unknown>[]>(
      'SELECT * FROM agents WHERE id = $1',
      [id],
    )
    return rows[0] ? this.deserialize(rows[0]) : null
  }

  /** Persist an agent's canvas position. */
  async updatePosition(id: string, x: number, y: number): Promise<void> {
    await this.db.execute(
      'UPDATE agents SET canvas_x = $1, canvas_y = $2 WHERE id = $3',
      [x, y, id],
    )
  }

  /** Replace an agent's assigned tool/skill ids (the store's assign action). */
  async updateToolIds(id: string, toolIds: string[]): Promise<void> {
    await this.db.execute(
      'UPDATE agents SET tool_ids = $1 WHERE id = $2',
      [JSON.stringify(toolIds), id],
    )
  }

  /** Replace an agent's assigned MCP server ids (the store's assign action). */
  async updateMcpIds(id: string, mcpIds: string[]): Promise<void> {
    await this.db.execute(
      'UPDATE agents SET mcp_ids = $1 WHERE id = $2',
      [JSON.stringify(mcpIds), id],
    )
  }

  /**
   * Patch an agent's editable fields. Builds the SET clause from the provided
   * keys in a fixed column order (`name`, `model_id`, `system_prompt`), so the
   * positional params are deterministic. A no-op (empty patch) issues no SQL.
   */
  async update(
    id: string,
    patch: { name?: string; modelId?: string | null; systemPrompt?: string; projectDirectory?: string | null },
  ): Promise<void> {
    const sets: string[] = []
    const params: unknown[] = []
    if ('name' in patch) {
      sets.push(`name = $${params.length + 1}`)
      params.push(patch.name)
    }
    if ('modelId' in patch) {
      sets.push(`model_id = $${params.length + 1}`)
      params.push(patch.modelId)
    }
    if ('systemPrompt' in patch) {
      sets.push(`system_prompt = $${params.length + 1}`)
      params.push(patch.systemPrompt)
    }
    if ('projectDirectory' in patch) {
      sets.push(`project_directory = $${params.length + 1}`)
      params.push(patch.projectDirectory)
    }
    if (sets.length === 0) return
    params.push(id)
    await this.db.execute(
      `UPDATE agents SET ${sets.join(', ')} WHERE id = $${params.length}`,
      params,
    )
  }

  /** Delete an agent (its sessions cascade away via the FK). */
  async delete(id: string): Promise<void> {
    await this.db.execute('DELETE FROM agents WHERE id = $1', [id])
  }

  /** Map a raw snake_case DB row to an {@link AgentRow}, parsing JSON columns. */
  private deserialize(row: Record<string, unknown>): AgentRow {
    return {
      id: row.id as string,
      name: row.name as string,
      type: row.type as AgentRow['type'],
      modelId: row.model_id as string | null,
      systemPrompt: row.system_prompt as string,
      projectDirectory: (row.project_directory as string | null) ?? null,
      toolIds: JSON.parse(row.tool_ids as string),
      mcpIds: JSON.parse(row.mcp_ids as string),
      canvasX: row.canvas_x as number,
      canvasY: row.canvas_y as number,
      groupId: row.group_id as string | null,
      createdAt: row.created_at as number,
    }
  }
}
