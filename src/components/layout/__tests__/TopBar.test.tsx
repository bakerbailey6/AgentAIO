import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TopBar } from '../TopBar'

describe('TopBar', () => {
  it('renders the title', () => {
    render(<TopBar approvalCount={0} onAddAgent={() => {}} />)
    expect(screen.getByText('Agent Command Center')).toBeInTheDocument()
  })

  it('calls onAddAgent when the New Agent button is clicked', () => {
    const onAddAgent = vi.fn()
    render(<TopBar approvalCount={0} onAddAgent={onAddAgent} />)
    fireEvent.click(screen.getByText('+ New Agent'))
    expect(onAddAgent).toHaveBeenCalledTimes(1)
  })

  it('hides the approval banner when approvalCount is 0', () => {
    render(<TopBar approvalCount={0} onAddAgent={() => {}} />)
    expect(screen.queryByText(/approval/)).toBeNull()
  })

  it('renders a singular banner for one approval', () => {
    render(<TopBar approvalCount={1} onAddAgent={() => {}} />)
    expect(screen.getByText('1 approval needed')).toBeInTheDocument()
  })

  it('renders a pluralized banner for multiple approvals', () => {
    render(<TopBar approvalCount={3} onAddAgent={() => {}} />)
    expect(screen.getByText('3 approvals needed')).toBeInTheDocument()
  })
})
