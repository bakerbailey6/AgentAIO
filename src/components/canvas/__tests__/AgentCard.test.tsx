import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('@/hooks/useAgentStatus', () => ({ useAgentStatus: () => 'running' }))
vi.mock('@/hooks/useApprovals', () => ({ useApprovals: () => [] }))

import { AgentCard } from '../AgentCard'

describe('AgentCard', () => {
  const baseProps = {
    agentId: 'a1',
    name: 'Coder',
    icon: '🧑‍💻',
    modelName: 'claude-sonnet-4-6',
    toolCount: 14,
    actions: [],
    onApprove: vi.fn(),
    onDeny: vi.fn(),
    onOpen: vi.fn(),
  }

  it('renders agent name', () => {
    render(<AgentCard {...baseProps} />)
    expect(screen.getByText('Coder')).toBeInTheDocument()
  })

  it('shows RUNNING status', () => {
    render(<AgentCard {...baseProps} />)
    expect(screen.getByText('RUNNING')).toBeInTheDocument()
  })

  it('shows model name', () => {
    render(<AgentCard {...baseProps} />)
    expect(screen.getByText(/claude-sonnet-4-6/)).toBeInTheDocument()
  })
})
