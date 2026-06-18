import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ApprovalGate } from '../ApprovalGate'
import type { ApprovalRequest } from '@/lib/interfaces'

const makeRequest = (risk: 'low' | 'medium' | 'high'): ApprovalRequest => ({
  id: 'req-1',
  agentId: 'agent-1',
  action: 'Read file',
  description: 'Reading config.json',
  risk,
})

describe('ApprovalGate', () => {
  it('renders the action and description', () => {
    render(<ApprovalGate request={makeRequest('low')} onApprove={vi.fn()} onDeny={vi.fn()} />)
    expect(screen.getByText('Read file')).toBeTruthy()
    expect(screen.getByText('Reading config.json')).toBeTruthy()
  })

  it('applies yellow color class for low risk', () => {
    const { container } = render(<ApprovalGate request={makeRequest('low')} onApprove={vi.fn()} onDeny={vi.fn()} />)
    const div = container.querySelector('div')
    expect(div?.className).toContain('yellow')
  })

  it('applies orange color class for medium risk', () => {
    const { container } = render(<ApprovalGate request={makeRequest('medium')} onApprove={vi.fn()} onDeny={vi.fn()} />)
    const div = container.querySelector('div')
    expect(div?.className).toContain('orange')
  })

  it('applies red color class for high risk', () => {
    const { container } = render(<ApprovalGate request={makeRequest('high')} onApprove={vi.fn()} onDeny={vi.fn()} />)
    const div = container.querySelector('div')
    expect(div?.className).toContain('red')
  })

  it('calls onApprove with request id when Approve button clicked', () => {
    const onApprove = vi.fn()
    render(<ApprovalGate request={makeRequest('low')} onApprove={onApprove} onDeny={vi.fn()} />)
    fireEvent.click(screen.getByText(/Approve/))
    expect(onApprove).toHaveBeenCalledWith('req-1')
  })

  it('calls onDeny with request id when Deny button clicked', () => {
    const onDeny = vi.fn()
    render(<ApprovalGate request={makeRequest('high')} onApprove={vi.fn()} onDeny={onDeny} />)
    fireEvent.click(screen.getByText(/Deny/))
    expect(onDeny).toHaveBeenCalledWith('req-1')
  })
})
