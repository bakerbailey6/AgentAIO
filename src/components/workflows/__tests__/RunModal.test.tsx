import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RunModal } from '../RunModal'

describe('RunModal', () => {
  it('renders nothing when open is false', () => {
    const { container } = render(
      <RunModal open={false} onClose={vi.fn()} onRun={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByText('Run workflow')).toBeNull()
  })

  it('renders the modal when open', () => {
    render(<RunModal open onClose={vi.fn()} onRun={vi.fn()} />)
    expect(screen.getByText('Run workflow')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('parses valid JSON and calls onRun with the parsed value', () => {
    const onRun = vi.fn()
    render(<RunModal open onClose={vi.fn()} onRun={onRun} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{"q":1}' } })
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))
    expect(onRun).toHaveBeenCalledWith({ q: 1 })
  })

  it('passes the raw string when the input is not valid JSON', () => {
    const onRun = vi.fn()
    render(<RunModal open onClose={vi.fn()} onRun={onRun} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello' } })
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))
    expect(onRun).toHaveBeenCalledWith('hello')
  })

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn()
    render(<RunModal open onClose={onClose} onRun={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('clears the Start input on Cancel so it cannot leak into the next open', () => {
    render(<RunModal open onClose={vi.fn()} onRun={vi.fn()} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'previous run input' } })
    expect(screen.getByRole('textbox')).toHaveValue('previous run input')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('textbox')).toHaveValue('')
  })

  it('clears the Start input after a Run', () => {
    render(<RunModal open onClose={vi.fn()} onRun={vi.fn()} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello' } })
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))
    expect(screen.getByRole('textbox')).toHaveValue('')
  })
})
