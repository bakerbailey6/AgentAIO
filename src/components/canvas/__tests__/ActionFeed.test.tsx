import { render, screen } from '@testing-library/react'
import { ActionFeed, type ActionEntry } from '../ActionFeed'

const entry = (over: Partial<ActionEntry> = {}): ActionEntry => ({
  id: 'e1',
  text: 'Reading file foo.ts',
  type: 'info',
  timestamp: 1000,
  ...over,
})

describe('ActionFeed', () => {
  it('renders one row per action entry', () => {
    render(
      <ActionFeed
        actions={[
          entry({ id: 'e1', text: 'first action' }),
          entry({ id: 'e2', text: 'second action' }),
        ]}
      />,
    )
    expect(screen.getByText(/first action/)).toBeInTheDocument()
    expect(screen.getByText(/second action/)).toBeInTheDocument()
  })

  it('caps the list at 4 rows', () => {
    const actions = Array.from({ length: 6 }, (_, i) =>
      entry({ id: `e${i}`, text: `action ${i}` }),
    )
    render(<ActionFeed actions={actions} />)
    // Only the first 4 (slice(0, 4)) are rendered
    expect(screen.getByText(/action 0/)).toBeInTheDocument()
    expect(screen.getByText(/action 3/)).toBeInTheDocument()
    expect(screen.queryByText(/action 4/)).not.toBeInTheDocument()
    expect(screen.queryByText(/action 5/)).not.toBeInTheDocument()
  })

  it('renders nothing for an empty list (no rows, no active action)', () => {
    const { container } = render(<ActionFeed actions={[]} />)
    // The scroll container renders but has no entry rows inside it
    const scroll = container.firstChild as HTMLElement
    expect(scroll).toBeInTheDocument()
    expect(scroll.childElementCount).toBe(0)
  })

  it('renders the active action banner when provided', () => {
    render(
      <ActionFeed
        actions={[]}
        activeAction={entry({ id: 'active', text: 'currently running' })}
      />,
    )
    expect(screen.getByText(/currently running/)).toBeInTheDocument()
  })

  it('applies the warning/error color treatment via prefix', () => {
    render(<ActionFeed actions={[entry({ id: 'w', text: 'boom', type: 'error' })]} />)
    // Error prefix is ✕
    expect(screen.getByText(/✕\s*boom/)).toBeInTheDocument()
  })
})
