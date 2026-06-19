import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import type { AgentRow } from '@/lib/storage'

// reactflow is heavy and needs a real flow host; mock it to a thin renderer that
// exposes each node's id/position and an onOpenChat trigger. useNodesState/
// useEdgesState are backed by real React state so the smart-merge effect runs.
vi.mock('reactflow', () => {
  const React = require('react')
  return {
    __esModule: true,
    default: ({ nodes, children }: any) =>
      React.createElement(
        'div',
        { 'data-testid': 'reactflow' },
        nodes.map((n: any) =>
          React.createElement(
            'div',
            {
              key: n.id,
              'data-testid': `node-${n.id}`,
              'data-x': String(n.position.x),
              'data-y': String(n.position.y),
            },
            React.createElement(
              'button',
              { 'data-testid': `open-${n.id}`, onClick: () => n.data.onOpenChat() },
              'open',
            ),
            React.createElement(
              'button',
              { 'data-testid': `edit-${n.id}`, onClick: () => n.data.onEdit() },
              'edit',
            ),
          ),
        ),
        children,
      ),
    Background: () => null,
    BackgroundVariant: { Dots: 'dots' },
    Controls: () => null,
    MiniMap: () => null,
    useNodesState: (init: any) => {
      const React = require('react')
      const [nodes, setNodes] = React.useState(init)
      return [nodes, setNodes, () => {}]
    },
    useEdgesState: (init: any) => {
      const React = require('react')
      const [edges, setEdges] = React.useState(init)
      return [edges, setEdges, () => {}]
    },
  }
})

vi.mock('@/lib/canvas/persistence', () => ({
  loadCanvasState: vi.fn(async () => null),
  saveAgentPosition: vi.fn(),
  saveCanvasState: vi.fn(),
}))

// Keep the canvas test isolated from the real node registry (and the agent
// providers it pulls in). The mocked ReactFlow ignores nodeTypes anyway.
vi.mock('@/lib/canvas/node-registry', () => ({ getNodeTypes: () => ({}) }))

import { AgentCanvas } from '../AgentCanvas'

const agent = (over: Partial<AgentRow> = {}): AgentRow => ({
  id: 'a1',
  name: 'Coder',
  type: 'llm',
  modelId: 'm1',
  systemPrompt: '',
  toolIds: ['t1', 't2'],
  mcpIds: [],
  canvasX: 120,
  canvasY: 240,
  groupId: null,
  createdAt: 0,
  ...over,
})

describe('AgentCanvas', () => {
  it('derives a node per agent with matching id and position', async () => {
    render(
      <AgentCanvas
        agents={[
          agent({ id: 'a1', canvasX: 10, canvasY: 20 }),
          agent({ id: 'a2', canvasX: 30, canvasY: 40 }),
        ]}
        onOpenChat={vi.fn()}
        onEdit={vi.fn()}
      />,
    )

    const n1 = await screen.findByTestId('node-a1')
    expect(n1).toHaveAttribute('data-x', '10')
    expect(n1).toHaveAttribute('data-y', '20')

    const n2 = screen.getByTestId('node-a2')
    expect(n2).toHaveAttribute('data-x', '30')
    expect(n2).toHaveAttribute('data-y', '40')
  })

  it('wires each node onOpenChat to call the prop with the agent id', async () => {
    const onOpenChat = vi.fn()
    render(<AgentCanvas agents={[agent({ id: 'a1' })]} onOpenChat={onOpenChat} onEdit={vi.fn()} />)

    fireEvent.click(await screen.findByTestId('open-a1'))
    expect(onOpenChat).toHaveBeenCalledWith('a1')
  })

  it('wires each node onEdit to call the prop with the agent id', async () => {
    const onEdit = vi.fn()
    render(<AgentCanvas agents={[agent({ id: 'a1' })]} onOpenChat={vi.fn()} onEdit={onEdit} />)

    fireEvent.click(await screen.findByTestId('edit-a1'))
    expect(onEdit).toHaveBeenCalledWith('a1')
  })

  it('appends a newly added agent on re-render without dropping existing nodes', async () => {
    const onOpenChat = vi.fn()
    const { rerender } = render(
      <AgentCanvas agents={[agent({ id: 'a1' })]} onOpenChat={onOpenChat} onEdit={vi.fn()} />,
    )
    await screen.findByTestId('node-a1')

    rerender(
      <AgentCanvas
        agents={[agent({ id: 'a1' }), agent({ id: 'a2', canvasX: 99, canvasY: 88 })]}
        onOpenChat={onOpenChat}
        onEdit={vi.fn()}
      />,
    )

    await waitFor(() => expect(screen.getByTestId('node-a2')).toBeInTheDocument())
    expect(screen.getByTestId('node-a1')).toBeInTheDocument()
  })

  it('renders nothing until canvas state has loaded', () => {
    // loadCanvasState resolves asynchronously, so the first synchronous render
    // returns null (no reactflow host yet).
    const { container } = render(<AgentCanvas agents={[]} onOpenChat={vi.fn()} onEdit={vi.fn()} />)
    expect(container.querySelector('[data-testid="reactflow"]')).toBeNull()
  })
})
