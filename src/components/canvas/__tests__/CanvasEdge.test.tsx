import { render, screen } from '@testing-library/react'
import type { EdgeProps } from 'reactflow'
import { vi } from 'vitest'

// reactflow's edge primitives need a flow context / SVG host to work for real;
// mock them to thin DOM stand-ins so we can test CanvasEdge's own logic.
vi.mock('reactflow', () => ({
  getBezierPath: () => ['M0,0 L10,10', 50, 60],
  BaseEdge: ({ id, path }: { id: string; path: string }) => (
    <path data-testid="base-edge" data-id={id} d={path} />
  ),
  EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="edge-label-layer">{children}</div>
  ),
}))

import { CanvasEdge } from '../CanvasEdge'

function renderEdge(over: Partial<EdgeProps> = {}) {
  const props = {
    id: 'edge-1',
    sourceX: 0,
    sourceY: 0,
    targetX: 100,
    targetY: 100,
    sourcePosition: 'right',
    targetPosition: 'left',
    ...over,
  } as unknown as EdgeProps
  return render(<CanvasEdge {...props} />)
}

describe('CanvasEdge', () => {
  it('renders the base edge path with the edge id', () => {
    renderEdge()
    const baseEdge = screen.getByTestId('base-edge')
    expect(baseEdge).toBeInTheDocument()
    expect(baseEdge).toHaveAttribute('data-id', 'edge-1')
    expect(baseEdge).toHaveAttribute('d', 'M0,0 L10,10')
  })

  it('renders a label when one is provided', () => {
    renderEdge({ label: 'depends on' })
    expect(screen.getByTestId('edge-label-layer')).toBeInTheDocument()
    expect(screen.getByText('depends on')).toBeInTheDocument()
  })

  it('omits the label layer when no label is provided', () => {
    renderEdge({ label: undefined })
    expect(screen.queryByTestId('edge-label-layer')).not.toBeInTheDocument()
  })
})
