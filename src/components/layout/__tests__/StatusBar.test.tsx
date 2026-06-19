import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBar } from '../StatusBar'

const baseProps = {
  runningCount: 3,
  idleCount: 5,
  approvalCount: 0,
  llmCallsToday: 42,
  estimatedCost: 1.2345,
  modelsConnected: 2,
  toolsActive: 7,
}

describe('StatusBar', () => {
  it('renders the running count', () => {
    render(<StatusBar {...baseProps} />)
    expect(screen.getByText('3 running')).toBeInTheDocument()
  })

  it('renders the idle count', () => {
    render(<StatusBar {...baseProps} />)
    expect(screen.getByText('5 idle')).toBeInTheDocument()
  })

  it('renders LLM calls with the cost formatted to two decimals', () => {
    render(<StatusBar {...baseProps} />)
    expect(screen.getByText('42 LLM calls · ~$1.23')).toBeInTheDocument()
  })

  it('renders the models and tools counts', () => {
    render(<StatusBar {...baseProps} />)
    expect(screen.getByText('2 models · 7 tools')).toBeInTheDocument()
  })

  it('hides the approvals indicator when approvalCount is 0', () => {
    render(<StatusBar {...baseProps} approvalCount={0} />)
    expect(screen.queryByText(/approvals/)).toBeNull()
  })

  it('shows the approvals indicator when approvalCount is greater than 0', () => {
    render(<StatusBar {...baseProps} approvalCount={4} />)
    expect(screen.getByText('4 approvals')).toBeInTheDocument()
  })
})
