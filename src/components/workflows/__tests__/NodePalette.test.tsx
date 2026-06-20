import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NodePalette } from '../NodePalette'

const { mockListWorkflowNodes } = vi.hoisted(() => ({
  mockListWorkflowNodes: vi.fn(),
}))

vi.mock('@/lib/workflows/node-registry', () => ({
  listWorkflowNodes: mockListWorkflowNodes,
}))

const FAKE_DEFS = [
  { type: 'agent', label: 'Agent', icon: '🤖', category: 'compute' },
  { type: 'output', label: 'Output', icon: '📤', category: 'io' },
]

function setup() {
  mockListWorkflowNodes.mockReturnValue(FAKE_DEFS)
  const onAdd = vi.fn()
  const utils = render(<NodePalette onAdd={onAdd} />)
  return { onAdd, ...utils }
}

describe('NodePalette', () => {
  it('renders a button for each registered node def', () => {
    setup()
    const agentBtn = screen.getByRole('button', { name: /Agent/ })
    const outputBtn = screen.getByRole('button', { name: /Output/ })
    expect(agentBtn).toBeDefined()
    expect(outputBtn).toBeDefined()
  })

  it('renders each def icon and label', () => {
    setup()
    expect(screen.getByText('Agent')).toBeDefined()
    expect(screen.getByText('Output')).toBeDefined()
    expect(screen.getByText('🤖')).toBeDefined()
    expect(screen.getByText('📤')).toBeDefined()
  })

  it('renders a panel header', () => {
    setup()
    expect(screen.getByText('Nodes')).toBeDefined()
  })

  it('calls onAdd with the def type when a button is clicked', () => {
    const { onAdd } = setup()
    fireEvent.click(screen.getByRole('button', { name: /Agent/ }))
    expect(onAdd).toHaveBeenCalledTimes(1)
    expect(onAdd).toHaveBeenCalledWith('agent')
  })

  it('calls onAdd with the correct type for each button', () => {
    const { onAdd } = setup()
    fireEvent.click(screen.getByRole('button', { name: /Output/ }))
    expect(onAdd).toHaveBeenCalledWith('output')
  })
})
