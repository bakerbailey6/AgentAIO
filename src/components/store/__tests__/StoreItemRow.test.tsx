import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StoreItemRow } from '../StoreItemRow'

function setup(overrides: Partial<React.ComponentProps<typeof StoreItemRow>> = {}) {
  const onInstall = vi.fn()
  const onUninstall = vi.fn()
  const utils = render(
    <StoreItemRow
      name="server-filesystem"
      description="Read and write files"
      version="0.6.2"
      installed={false}
      onInstall={onInstall}
      onUninstall={onUninstall}
      {...overrides}
    />,
  )
  return { onInstall, onUninstall, ...utils }
}

describe('StoreItemRow', () => {
  it('renders name, version, and description', () => {
    setup()
    expect(screen.getByText('server-filesystem')).toBeDefined()
    expect(screen.getByText('v0.6.2')).toBeDefined()
    expect(screen.getByText('Read and write files')).toBeDefined()
  })

  it('shows Install and fires onInstall when not installed', () => {
    const { onInstall } = setup({ installed: false })
    const button = screen.getByText('Install')
    fireEvent.click(button)
    expect(onInstall).toHaveBeenCalledTimes(1)
  })

  it('shows Remove and fires onUninstall when installed', () => {
    const { onUninstall } = setup({ installed: true })
    const button = screen.getByText('Remove')
    fireEvent.click(button)
    expect(onUninstall).toHaveBeenCalledTimes(1)
  })

  it('shows a spinner and no action button while installing', () => {
    const { container } = setup({ installing: true })
    expect(screen.queryByText('Install')).toBeNull()
    expect(screen.queryByText('Remove')).toBeNull()
    expect(container.querySelector('.animate-spin')).not.toBeNull()
  })

  it('lists assigned agents when present', () => {
    setup({ assignedAgents: ['Researcher', 'Coder'] })
    expect(screen.getByText('Assigned to: Researcher, Coder')).toBeDefined()
  })

  it('omits the assigned-agents line when empty', () => {
    setup({ assignedAgents: [] })
    expect(screen.queryByText(/Assigned to:/)).toBeNull()
  })
})
