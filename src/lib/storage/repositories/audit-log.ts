// src/lib/storage/repositories/audit-log.ts
import type { Db } from '../db'

export interface AuditLogEntry {
  agentId: string
  actionType: string
  payload: unknown
  approvedBy?: string
}

export class AuditLogRepository {
  constructor(private db: Db) {}

  async append(entry: AuditLogEntry): Promise<void> {
    await this.db.execute(
      `INSERT INTO audit_log (agent_id, action_type, payload, approved_by)
       VALUES ($1, $2, $3, $4)`,
      [
        entry.agentId,
        entry.actionType,
        JSON.stringify(entry.payload),
        entry.approvedBy ?? null,
      ],
    )
  }

  async findByAgent(agentId: string, limit = 50): Promise<AuditLogEntry[]> {
    const rows = await this.db.select<Record<string, unknown>[]>(
      'SELECT * FROM audit_log WHERE agent_id = $1 ORDER BY timestamp DESC LIMIT $2',
      [agentId, limit],
    )
    return rows.map((r) => ({
      agentId: r.agent_id as string,
      actionType: r.action_type as string,
      payload: JSON.parse(r.payload as string),
      approvedBy: r.approved_by as string | undefined,
    }))
  }
}
