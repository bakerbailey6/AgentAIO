import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    execute: vi.fn(async (_sql: string, _params?: unknown[]) => ({ rowsAffected: 1 })),
    select: vi.fn(async () => [] as unknown[]),
  },
}))
vi.mock('@tauri-apps/plugin-sql', () => ({ default: { load: vi.fn(async () => mockDb) } }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => null) }))

import { WorkflowRunRepository } from '@/lib/storage/repositories/workflow-runs'

function makeRepo() {
  return new WorkflowRunRepository(mockDb as never)
}

describe('WorkflowRunRepository', () => {
  beforeEach(() => vi.clearAllMocks())

  it('create issues INSERT INTO workflow_runs and JSON-encodes input', async () => {
    const repo = makeRepo()
    const input = { prompt: 'hello' }
    const id = await repo.create({ workflowId: 'wf1', input })

    expect(typeof id).toBe('string')
    const [sql, params] = mockDb.execute.mock.calls[0]
    expect(sql).toContain('INSERT INTO workflow_runs')
    expect(sql).toContain('(id, workflow_id, input)')
    expect(sql).toContain('VALUES ($1, $2, $3)')
    expect(params).toEqual([id, 'wf1', JSON.stringify(input)])
  })

  it('create defaults input to JSON null when omitted', async () => {
    const repo = makeRepo()
    const id = await repo.create({ workflowId: 'wf1' })
    const [, params] = mockDb.execute.mock.calls[0]
    expect(params).toEqual([id, 'wf1', JSON.stringify(null)])
  })

  it('finish issues the terminal UPDATE with status, result, node_states and finished_at', async () => {
    const repo = makeRepo()
    const result = { ok: true }
    const nodeStates = { n1: { status: 'done' } }
    await repo.finish('run1', { status: 'done', result, nodeStates })
    expect(mockDb.execute).toHaveBeenCalledWith(
      'UPDATE workflow_runs SET status = $1, result = $2, node_states = $3, finished_at = unixepoch() WHERE id = $4',
      ['done', JSON.stringify(result), JSON.stringify(nodeStates), 'run1'],
    )
  })

  it('finish defaults result to JSON null and node_states to {} when omitted', async () => {
    const repo = makeRepo()
    await repo.finish('run1', { status: 'error' })
    const [, params] = mockDb.execute.mock.calls[0]
    expect(params).toEqual(['error', JSON.stringify(null), JSON.stringify({}), 'run1'])
  })

  it('findByWorkflowId selects ordered by started_at DESC and maps snake_case → camelCase', async () => {
    mockDb.select.mockResolvedValueOnce([
      {
        id: 'run1',
        workflow_id: 'wf1',
        status: 'done',
        input: '{"prompt":"hi"}',
        result: '{"ok":true}',
        node_states: '{"n1":{"status":"done"}}',
        started_at: 100,
        finished_at: 200,
      },
    ])
    const repo = makeRepo()
    const rows = await repo.findByWorkflowId('wf1')

    expect(mockDb.select).toHaveBeenCalledWith(
      'SELECT * FROM workflow_runs WHERE workflow_id = $1 ORDER BY started_at DESC',
      ['wf1'],
    )
    expect(rows).toEqual([
      {
        id: 'run1',
        workflowId: 'wf1',
        status: 'done',
        input: { prompt: 'hi' },
        result: { ok: true },
        nodeStates: { n1: { status: 'done' } },
        startedAt: 100,
        finishedAt: 200,
      },
    ])
  })

  it('findByWorkflowId maps a null finished_at (still running) to null', async () => {
    mockDb.select.mockResolvedValueOnce([
      {
        id: 'run2',
        workflow_id: 'wf1',
        status: 'running',
        input: 'null',
        result: 'null',
        node_states: '{}',
        started_at: 50,
        finished_at: null,
      },
    ])
    const repo = makeRepo()
    const rows = await repo.findByWorkflowId('wf1')
    expect(rows[0]).toEqual({
      id: 'run2',
      workflowId: 'wf1',
      status: 'running',
      input: null,
      result: null,
      nodeStates: {},
      startedAt: 50,
      finishedAt: null,
    })
  })

  it('findByWorkflowId returns [] when select resolves []', async () => {
    mockDb.select.mockResolvedValueOnce([])
    const repo = makeRepo()
    expect(await repo.findByWorkflowId('wf1')).toEqual([])
  })
})
