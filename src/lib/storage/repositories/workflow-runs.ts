/**
 * Repository for the `workflow_runs` table — one row per execution of a saved
 * workflow.
 *
 * A run starts in `running` with its `input` captured, then is finalized via
 * {@link WorkflowRunRepository.finish} to `done`/`error` with a `result` and
 * per-node states. The JSON `input` / `result` columns and the `node_states`
 * object are (de)serialized here. See {@link WorkflowRepository} for the pattern.
 *
 * @module
 */
import type { Db } from '../db'

/** A workflow run as stored, with JSON columns already parsed. */
export interface WorkflowRunRow {
  id: string
  workflowId: string
  status: 'running' | 'done' | 'error'
  input: unknown
  result: unknown
  nodeStates: Record<string, unknown>
  startedAt: number
  finishedAt: number | null
}

interface WorkflowRunInsert {
  workflowId: string
  input?: unknown
}

interface WorkflowRunFinish {
  status: 'done' | 'error'
  result?: unknown
  nodeStates?: Record<string, unknown>
}

export class WorkflowRunRepository {
  constructor(private db: Db) {}

  /** Start a new run (status `running`) and return its generated id. */
  async create(data: WorkflowRunInsert): Promise<string> {
    const id = crypto.randomUUID()
    await this.db.execute(
      `INSERT INTO workflow_runs (id, workflow_id, input)
       VALUES ($1, $2, $3)`,
      [id, data.workflowId, JSON.stringify(data.input ?? null)],
    )
    return id
  }

  /** Finalize a run with its terminal status, result, and per-node states. */
  async finish(id: string, data: WorkflowRunFinish): Promise<void> {
    await this.db.execute(
      `UPDATE workflow_runs SET status = $1, result = $2, node_states = $3, finished_at = unixepoch() WHERE id = $4`,
      [
        data.status,
        JSON.stringify(data.result ?? null),
        JSON.stringify(data.nodeStates ?? {}),
        id,
      ],
    )
  }

  /** Return every run for a workflow, most recently started first. */
  async findByWorkflowId(workflowId: string): Promise<WorkflowRunRow[]> {
    const rows = await this.db.select<Record<string, unknown>[]>(
      'SELECT * FROM workflow_runs WHERE workflow_id = $1 ORDER BY started_at DESC',
      [workflowId],
    )
    return rows.map(this.deserialize)
  }

  /** Map a raw snake_case DB row to a {@link WorkflowRunRow}, parsing JSON columns. */
  private deserialize(row: Record<string, unknown>): WorkflowRunRow {
    return {
      id: row.id as string,
      workflowId: row.workflow_id as string,
      status: row.status as WorkflowRunRow['status'],
      input: JSON.parse(row.input as string),
      result: JSON.parse(row.result as string),
      nodeStates: JSON.parse(row.node_states as string),
      startedAt: row.started_at as number,
      finishedAt: (row.finished_at as number | null) ?? null,
    }
  }
}
