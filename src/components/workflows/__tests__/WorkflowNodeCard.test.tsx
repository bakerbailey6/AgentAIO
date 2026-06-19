import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { NodeProps } from 'reactflow'

// --- mocks (hoisted, before importing the component under test) ---
// reactflow's Handle renders a real DOM node carrying its props so the test can
// count target/source handles and read their ids.
vi.mock('reactflow', () => ({
  Handle: ({ type, position, id }: { type: string; position: string; id?: string }) => (
    <div data-testid="handle" data-handle-type={type} data-position={position} data-handleid={id} />
  ),
  Position: { Left: 'left', Right: 'right' },
}))

// Fake registry: a single `join` def whose ports() returns 2 inputs + 1 output.
vi.mock('@/lib/workflows/node-registry', () => ({
  WORKFLOW_NODE_REGISTRY: new Map([
    [
      'join',
      {
        type: 'join',
        category: 'compute',
        label: 'Join',
        icon: '🔗',
        ports: (config: { count?: number }) => ({
          inputs: Array.from({ length: config.count ?? 2 }, (_, i) => ({
            name: `in${i + 1}`,
            label: `In ${i + 1}`,
            type: 'any',
          })),
          outputs: [{ name: 'value', label: 'Value', type: 'json' }],
        }),
        defaultConfig: () => ({ count: 2 }),
        ConfigPanel: () => null,
      },
    ],
  ]),
}))

import { WorkflowNodeCard, WORKFLOW_NODE_TYPE, type WorkflowNodeCardData } from '../WorkflowNodeCard'

function renderCard(over: Partial<WorkflowNodeCardData> = {}) {
  const data: WorkflowNodeCardData = {
    type: 'join',
    config: { count: 2 },
    label: 'Merge results',
    ...over,
  }
  const props = { data } as unknown as NodeProps<WorkflowNodeCardData>
  return render(<WorkflowNodeCard {...props} />)
}

describe('WorkflowNodeCard', () => {
  it('exposes the single workflow RF node type', () => {
    expect(WORKFLOW_NODE_TYPE).toBe('workflowNode')
  })

  it('renders the data label and the def icon', () => {
    renderCard()
    expect(screen.getByText('Merge results')).toBeInTheDocument()
    expect(screen.getByText('🔗')).toBeInTheDocument()
  })

  it('renders a target handle per input port and a source handle per output port', () => {
    renderCard()
    const handles = screen.getAllByTestId('handle')
    const targets = handles.filter((h) => h.getAttribute('data-handle-type') === 'target')
    const sources = handles.filter((h) => h.getAttribute('data-handle-type') === 'source')
    expect(targets).toHaveLength(2)
    expect(sources).toHaveLength(1)
  })

  it('gives each handle the port name as its id and positions inputs left / outputs right', () => {
    renderCard()
    const handles = screen.getAllByTestId('handle')
    const targets = handles.filter((h) => h.getAttribute('data-handle-type') === 'target')
    const sources = handles.filter((h) => h.getAttribute('data-handle-type') === 'source')
    expect(targets.map((h) => h.getAttribute('data-handleid'))).toEqual(['in1', 'in2'])
    expect(targets.every((h) => h.getAttribute('data-position') === 'left')).toBe(true)
    expect(sources.map((h) => h.getAttribute('data-handleid'))).toEqual(['value'])
    expect(sources.every((h) => h.getAttribute('data-position') === 'right')).toBe(true)
  })

  it('defaults to no handles when the type is unknown to the registry', () => {
    renderCard({ type: 'mystery', label: 'Mystery' })
    expect(screen.queryAllByTestId('handle')).toHaveLength(0)
    expect(screen.getByText('Mystery')).toBeInTheDocument()
  })

  it('colors the status ring by runStatus', () => {
    const { container, rerender } = renderCard({ runStatus: 'running' })
    const card = container.querySelector('[data-run-status]') as HTMLElement
    expect(card.getAttribute('data-run-status')).toBe('running')
    expect(card.className).toMatch(/indigo|amber/)

    const props = (status: WorkflowNodeCardData['runStatus']) =>
      ({ data: { type: 'join', config: { count: 2 }, label: 'Join', runStatus: status } }) as unknown as NodeProps<WorkflowNodeCardData>

    rerender(<WorkflowNodeCard {...props('done')} />)
    expect((container.querySelector('[data-run-status]') as HTMLElement).className).toMatch(/green|emerald/)

    rerender(<WorkflowNodeCard {...props('error')} />)
    expect((container.querySelector('[data-run-status]') as HTMLElement).className).toMatch(/red/)
  })
})
