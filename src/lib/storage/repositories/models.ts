/**
 * Repository for the `models` table — configured LLM models the user has added.
 * `apiKeyRef` is a *keychain reference*, not the key itself; the {@link LLMRouter}
 * resolves it to a secret at call time. See {@link AgentRepository} for the pattern.
 *
 * @module
 */
import type { Db } from '../db'

export interface ModelRow {
  id: string
  provider: string
  modelName: string
  displayName: string
  apiKeyRef: string | null
  baseUrl: string | null
  createdAt: number
}

interface ModelInsert {
  provider: string
  modelName: string
  displayName: string
  apiKeyRef?: string | null
  baseUrl?: string | null
}

export class ModelRepository {
  constructor(private db: Db) {}

  async create(data: ModelInsert): Promise<string> {
    const id = crypto.randomUUID()
    await this.db.execute(
      `INSERT INTO models (id, provider, model_name, display_name, api_key_ref, base_url)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        id,
        data.provider,
        data.modelName,
        data.displayName,
        data.apiKeyRef ?? null,
        data.baseUrl ?? null,
      ],
    )
    return id
  }

  async findAll(): Promise<ModelRow[]> {
    const rows = await this.db.select<Record<string, unknown>[]>('SELECT * FROM models')
    return rows.map(this.deserialize)
  }

  async findById(id: string): Promise<ModelRow | null> {
    const rows = await this.db.select<Record<string, unknown>[]>(
      'SELECT * FROM models WHERE id = $1',
      [id],
    )
    return rows[0] ? this.deserialize(rows[0]) : null
  }

  async delete(id: string): Promise<void> {
    await this.db.execute('DELETE FROM models WHERE id = $1', [id])
  }

  private deserialize(row: Record<string, unknown>): ModelRow {
    return {
      id: row.id as string,
      provider: row.provider as string,
      modelName: row.model_name as string,
      displayName: row.display_name as string,
      apiKeyRef: row.api_key_ref as string | null,
      baseUrl: row.base_url as string | null,
      createdAt: row.created_at as number,
    }
  }
}
