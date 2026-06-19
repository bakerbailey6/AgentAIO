import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// --- Storage mocks --------------------------------------------------------
// WorkflowRepository is used with `new`, so it MUST be a class/function — never
// an arrow function (arrow functions are not constructable).
const { mockDb, findAll, create, del } = vi.hoisted(() => ({
  mockDb: {},
  findAll: vi.fn(),
  create: vi.fn(),
  del: vi.fn(),
}))

vi.mock('@/lib/storage', () => ({
  initDb: vi.fn(async () => mockDb),
  WorkflowRepository: vi.fn().mockImplementation(function () {
    return { findAll, create, delete: del }
  }),
}))

// --- WorkflowEditor stub (keep this test about the panel) -----------------
vi.mock('@/components/workflows/WorkflowEditor', () => ({
  WorkflowEditor: ({ workflowId, onBack }: { workflowId: string; onBack: () => void }) => (
    <div data-testid="editor">
      editor:{workflowId}
      <button onClick={onBack}>back</button>
    </div>
  ),
}))

import { WorkflowsPanel } from '../WorkflowsPanel'

const WF_ONE = {
  id: 'wf1',
  name: 'WF One',
  description: '',
  nodes: [],
  edges: [],
  createdAt: 0,
  updatedAt: 0,
}

describe('WorkflowsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findAll.mockResolvedValue([WF_ONE])
    create.mockResolvedValue('wf2')
    del.mockResolvedValue(undefined)
  })

  it('lists workflows after load', async () => {
    render(<WorkflowsPanel onClose={() => {}} />)
    expect(await screen.findByText('WF One')).toBeInTheDocument()
    expect(findAll).toHaveBeenCalled()
  })

  it('shows the empty state when there are no workflows', async () => {
    findAll.mockResolvedValue([])
    render(<WorkflowsPanel onClose={() => {}} />)
    expect(await screen.findByText('No workflows yet.')).toBeInTheDocument()
  })

  it('creates a new workflow and opens the editor', async () => {
    render(<WorkflowsPanel onClose={() => {}} />)
    await screen.findByText('WF One')
    fireEvent.click(screen.getByText('New workflow'))
    await waitFor(() => expect(create).toHaveBeenCalledWith({ name: 'Untitled workflow' }))
    expect(await screen.findByTestId('editor')).toHaveTextContent('editor:wf2')
  })

  it('opens the editor when a row is clicked', async () => {
    render(<WorkflowsPanel onClose={() => {}} />)
    fireEvent.click(await screen.findByText('WF One'))
    expect(await screen.findByTestId('editor')).toHaveTextContent('editor:wf1')
  })

  it('returns to the list when Back is pressed', async () => {
    render(<WorkflowsPanel onClose={() => {}} />)
    fireEvent.click(await screen.findByText('WF One'))
    const editor = await screen.findByTestId('editor')
    expect(editor).toBeInTheDocument()
    fireEvent.click(screen.getByText('back'))
    await waitFor(() => expect(screen.queryByTestId('editor')).not.toBeInTheDocument())
    expect(await screen.findByText('WF One')).toBeInTheDocument()
  })

  it('deletes a workflow', async () => {
    render(<WorkflowsPanel onClose={() => {}} />)
    await screen.findByText('WF One')
    fireEvent.click(screen.getByLabelText('Delete WF One'))
    await waitFor(() => expect(del).toHaveBeenCalledWith('wf1'))
  })

  it('calls onClose from the close button', async () => {
    const onClose = vi.fn()
    render(<WorkflowsPanel onClose={onClose} />)
    await screen.findByText('WF One')
    fireEvent.click(screen.getByLabelText('Close workflows'))
    expect(onClose).toHaveBeenCalled()
  })
})
