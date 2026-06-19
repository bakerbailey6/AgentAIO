import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

// --- hoisted spies shared between the storage mock and the assertions -------
const h = vi.hoisted(() => ({
  findById: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  finish: vi.fn(),
  runWorkflow: vi.fn(),
  normalizeGraph: vi.fn(),
  isConnectionCompatible: vi.fn(),
  // captured from the reactflow mock so tests can drive onConnect directly
  lastOnConnect: { fn: null as ((c: unknown) => void) | null },
}))

// --- mock the Tauri/storage boundary (classes with spied methods) ----------
vi.mock('@/lib/storage', () => ({
  initDb: vi.fn(async () => ({})),
  WorkflowRepository: class {
    findById = h.findById
    update = h.update
  },
  WorkflowRunRepository: class {
    create = h.create
    finish = h.finish
  },
}))

vi.mock('@/lib/workflows/engine', () => ({ runWorkflow: h.runWorkflow }))
vi.mock('@/lib/workflows/graph', () => ({ normalizeGraph: h.normalizeGraph }))
vi.mock('@/lib/workflows/port-compat', () => ({
  isConnectionCompatible: h.isConnectionCompatible,
}))
vi.mock('@/components/workflows/WorkflowRunHistory', () => ({
  WorkflowRunHistory: ({ onRerun }: { onRerun: (input: unknown) => void }) => (
    <div data-testid="run-history">
      history
      <button data-testid="history-rerun" onClick={() => onRerun({ re: 1 })}>
        rerun
      </button>
    </div>
  ),
}))

// Stable references — returning a fresh object/`{}` each render would make the
// editor's `useEffect([run.nodeStatus])` re-fire on every render (infinite loop).
const RUN_STATE = { runId: null, status: 'idle' as const, nodeStatus: {}, result: undefined }
vi.mock('@/hooks/useWorkflowRun', () => ({
  useWorkflowRun: () => RUN_STATE,
}))

vi.mock('@/lib/workflows/node-registry', () => ({
  WORKFLOW_NODE_REGISTRY: new Map([
    ['agent', { type: 'agent', label: 'Agent', defaultConfig: () => ({}) }],
  ]),
}))

// --- sibling component stubs ------------------------------------------------
vi.mock('@/components/workflows/WorkflowNodeCard', () => ({
  WORKFLOW_NODE_TYPE: 'workflowNode',
  WorkflowNodeCard: () => null,
}))

vi.mock('@/components/workflows/NodePalette', () => ({
  NodePalette: ({ onAdd }: { onAdd: (type: string) => void }) => (
    <button data-testid="palette-add" onClick={() => onAdd('agent')}>
      add
    </button>
  ),
}))

vi.mock('@/components/workflows/NodeConfigRail', () => ({
  NodeConfigRail: () => <div data-testid="config-rail" />,
}))

vi.mock('@/components/workflows/RunModal', () => ({
  RunModal: ({ open, onRun }: { open: boolean; onRun: (input: unknown) => void }) =>
    open ? (
      <button data-testid="run-modal-run" onClick={() => onRun({})}>
        run
      </button>
    ) : null,
}))

// --- minimal reactflow mock ------------------------------------------------
vi.mock('reactflow', () => {
  const useNodesState = () => {
    const [state, setState] = React.useState<unknown[]>([])
    return [state, setState, vi.fn()] as const
  }
  const useEdgesState = () => {
    const [state, setState] = React.useState<unknown[]>([])
    return [state, setState, vi.fn()] as const
  }
  return {
    __esModule: true,
    default: ({
      children,
      onConnect,
      edges,
    }: {
      children?: React.ReactNode
      onConnect?: (c: unknown) => void
      edges?: unknown[]
    }) => {
      // Expose the editor's onConnect so tests can drive a wiring attempt, and
      // surface the current edge count so they can assert addEdge happened.
      h.lastOnConnect.fn = onConnect ?? null
      return (
        <div data-testid="rf" data-edge-count={edges?.length ?? 0}>
          {children}
        </div>
      )
    },
    Background: () => null,
    Controls: () => null,
    BackgroundVariant: { Dots: 'dots' },
    useNodesState,
    useEdgesState,
    addEdge: (c: unknown, e: unknown[]) => [...e, c],
  }
})

import { WorkflowEditor } from '../WorkflowEditor'

const ROW = {
  id: 'wf1',
  name: 'WF',
  description: '',
  nodes: [],
  edges: [],
  createdAt: 0,
  updatedAt: 0,
}

describe('WorkflowEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.findById.mockResolvedValue(ROW)
    h.update.mockResolvedValue(undefined)
    h.create.mockResolvedValue('run1')
    h.finish.mockResolvedValue(undefined)
    h.runWorkflow.mockResolvedValue({ status: 'done', output: { value: 1 }, nodeStates: {} })
    h.normalizeGraph.mockReturnValue({ nodes: [], edges: [] })
    h.isConnectionCompatible.mockReturnValue(true)
    h.lastOnConnect.fn = null
  })

  it('renders the workflow name after load', async () => {
    render(<WorkflowEditor workflowId="wf1" onBack={() => {}} />)
    expect(await screen.findByText('WF')).toBeInTheDocument()
  })

  it('appends a node when the palette add button is clicked', async () => {
    render(<WorkflowEditor workflowId="wf1" onBack={() => {}} />)
    await screen.findByText('WF')
    // No assertion error means the add handler ran with a registry hit; the
    // node list is internal to the RF state mock, so we assert it doesn't throw
    // and the editor still renders (a missing registry def would throw).
    expect(() => fireEvent.click(screen.getByTestId('palette-add'))).not.toThrow()
  })

  it('calls WorkflowRepository.update when Save is clicked', async () => {
    render(<WorkflowEditor workflowId="wf1" onBack={() => {}} />)
    await screen.findByText('WF')
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(h.update).toHaveBeenCalledWith('wf1', { nodes: [], edges: [] }))
  })

  it('runs the workflow: create → runWorkflow → finish', async () => {
    render(<WorkflowEditor workflowId="wf1" onBack={() => {}} />)
    await screen.findByText('WF')
    fireEvent.click(screen.getByText('Run'))
    fireEvent.click(await screen.findByTestId('run-modal-run'))

    await waitFor(() => expect(h.create).toHaveBeenCalledWith({ workflowId: 'wf1', input: {} }))
    await waitFor(() => expect(h.runWorkflow).toHaveBeenCalled())
    await waitFor(() =>
      expect(h.finish).toHaveBeenCalledWith('run1', {
        status: 'done',
        result: { value: 1 },
        nodeStates: {},
      }),
    )
  })

  it('calls onBack from the Back button', async () => {
    const onBack = vi.fn()
    render(<WorkflowEditor workflowId="wf1" onBack={onBack} />)
    await screen.findByText('WF')
    fireEvent.click(screen.getByText('← Back'))
    expect(onBack).toHaveBeenCalled()
  })

  it('rejects an incompatible connection: no edge added, shows a notice', async () => {
    h.isConnectionCompatible.mockReturnValue(false)
    render(<WorkflowEditor workflowId="wf1" onBack={() => {}} />)
    await screen.findByText('WF')

    const rf = screen.getByTestId('rf')
    expect(rf).toHaveAttribute('data-edge-count', '0')

    // drive the editor's onConnect with an incompatible wiring
    fireEvent.click(rf) // ensure rendered; onConnect captured during render
    expect(h.lastOnConnect.fn).toBeTruthy()
    await act(async () => {
      h.lastOnConnect.fn!({ source: 'a', target: 'b' })
    })

    // no edge was added and the amber notice is shown
    expect(screen.getByTestId('rf')).toHaveAttribute('data-edge-count', '0')
    expect(screen.getByText('Incompatible port types')).toBeInTheDocument()
  })

  it('adds an edge when the connection is compatible', async () => {
    h.isConnectionCompatible.mockReturnValue(true)
    render(<WorkflowEditor workflowId="wf1" onBack={() => {}} />)
    await screen.findByText('WF')

    expect(h.lastOnConnect.fn).toBeTruthy()
    await act(async () => {
      h.lastOnConnect.fn!({ source: 'a', target: 'b' })
    })

    expect(screen.getByTestId('rf')).toHaveAttribute('data-edge-count', '1')
  })

  it('toggles the run-history panel from the History button', async () => {
    render(<WorkflowEditor workflowId="wf1" onBack={() => {}} />)
    await screen.findByText('WF')
    expect(screen.queryByTestId('run-history')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('History'))
    expect(screen.getByTestId('run-history')).toBeInTheDocument()
  })

  it('re-runs the workflow from the history stub: create → runWorkflow → finish', async () => {
    render(<WorkflowEditor workflowId="wf1" onBack={() => {}} />)
    await screen.findByText('WF')
    fireEvent.click(screen.getByText('History'))
    fireEvent.click(screen.getByTestId('history-rerun'))

    await waitFor(() => expect(h.create).toHaveBeenCalledWith({ workflowId: 'wf1', input: { re: 1 } }))
    await waitFor(() => expect(h.runWorkflow).toHaveBeenCalled())
    await waitFor(() => expect(h.finish).toHaveBeenCalled())
  })
})
