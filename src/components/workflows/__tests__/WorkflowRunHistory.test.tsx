import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// --- Storage mocks --------------------------------------------------------
// WorkflowRunRepository is used with `new`, so it MUST be a class/function —
// never an arrow function (arrow functions are not constructable).
const { mockDb, findByWorkflowId } = vi.hoisted(() => ({
  mockDb: {},
  findByWorkflowId: vi.fn(),
}))

vi.mock('@/lib/storage', () => ({
  initDb: vi.fn(async () => mockDb),
  WorkflowRunRepository: vi.fn().mockImplementation(function () {
    return { findByWorkflowId }
  }),
}))

import { WorkflowRunHistory } from '../WorkflowRunHistory'

const RUN_ONE = {
  id: 'r1',
  workflowId: 'wf1',
  status: 'done' as const,
  input: { q: 1 },
  result: { ok: true },
  nodeStates: {},
  startedAt: 0,
  finishedAt: 1,
}

describe('WorkflowRunHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findByWorkflowId.mockResolvedValue([RUN_ONE])
  })

  it('lists a run after load', async () => {
    render(<WorkflowRunHistory workflowId="wf1" onRerun={() => {}} />)
    expect(await screen.findByText('done')).toBeInTheDocument()
    expect(findByWorkflowId).toHaveBeenCalledWith('wf1')
  })

  it('calls onRerun with the run input when Re-run is clicked', async () => {
    const onRerun = vi.fn()
    render(<WorkflowRunHistory workflowId="wf1" onRerun={onRerun} />)
    fireEvent.click(await screen.findByText('Re-run'))
    expect(onRerun).toHaveBeenCalledWith({ q: 1 })
  })

  it('shows the empty state when there are no runs', async () => {
    findByWorkflowId.mockResolvedValue([])
    render(<WorkflowRunHistory workflowId="wf1" onRerun={() => {}} />)
    expect(await screen.findByText('No runs yet.')).toBeInTheDocument()
  })
})
