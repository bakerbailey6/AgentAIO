import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { NodeConfig } from '@/lib/interfaces'
import { NodeConfigRail } from '../NodeConfigRail'

// Fake def whose ConfigPanel renders an input wired to onChange so we can prove
// edits bubble up through the rail with the config merged.
function FakeConfigPanel({
  config,
  onChange,
}: {
  config: NodeConfig
  onChange: (c: NodeConfig) => void
}) {
  return (
    <input
      aria-label="x"
      value={String(config.x ?? '')}
      onChange={(e) => onChange({ ...config, x: e.target.value })}
    />
  )
}

// `vi.mock` is hoisted above module scope, so the fake registry must be built
// inside `vi.hoisted()` to be available to the factory.
const { fakeRegistry } = vi.hoisted(() => ({
  fakeRegistry: new Map([
    [
      'fake',
      {
        type: 'fake',
        category: 'compute' as const,
        label: 'Fake Node',
        icon: '🧪',
        ports: () => ({ inputs: [], outputs: [] }),
        defaultConfig: () => ({}),
        ConfigPanel: FakeConfigPanel,
      },
    ],
  ]),
}))

vi.mock('@/lib/workflows/node-registry', () => ({
  WORKFLOW_NODE_REGISTRY: fakeRegistry,
}))

describe('NodeConfigRail', () => {
  it('renders nothing when node is null', () => {
    const { container } = render(
      <NodeConfigRail node={null} onChange={vi.fn()} onClose={vi.fn()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders the def's label and ConfigPanel for a selected node", () => {
    render(
      <NodeConfigRail
        node={{ id: 'n1', type: 'fake', config: { x: 'hi' } }}
        onChange={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('Fake Node')).toBeTruthy()
    expect((screen.getByLabelText('x') as HTMLInputElement).value).toBe('hi')
  })

  it('bubbles ConfigPanel edits up through onChange, merged with config', () => {
    const onChange = vi.fn()
    render(
      <NodeConfigRail
        node={{ id: 'n1', type: 'fake', config: { x: 'a', keep: 1 } }}
        onChange={onChange}
        onClose={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByLabelText('x'), { target: { value: 'ab' } })
    expect(onChange).toHaveBeenCalledWith({ x: 'ab', keep: 1 })
  })

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    render(
      <NodeConfigRail
        node={{ id: 'n1', type: 'fake', config: {} }}
        onChange={vi.fn()}
        onClose={onClose}
      />,
    )
    fireEvent.click(screen.getByLabelText('Close config'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows a muted note for an unregistered node type', () => {
    render(
      <NodeConfigRail
        node={{ id: 'n1', type: 'nope', config: {} }}
        onChange={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('Unknown node type')).toBeTruthy()
  })
})
