import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { StorePanel } from '../StorePanel'
import { MCP_CATALOG } from '@/lib/store/catalog'

const { mockInstall, mockUninstall, mockIsInstalled } = vi.hoisted(() => ({
  mockInstall: vi.fn(),
  mockUninstall: vi.fn(),
  mockIsInstalled: vi.fn(),
}))

let mcpsFixture: Array<{ id: string; name: string }> = []

vi.mock('@/hooks/useInstalledMcps', () => ({
  useInstalledMcps: () => ({
    mcps: mcpsFixture,
    install: mockInstall,
    uninstall: mockUninstall,
    isInstalled: mockIsInstalled,
  }),
}))
vi.mock('@/lib/storage', () => ({
  initDb: vi.fn(async () => ({})),
  McpRepository: class {
    create = vi.fn()
  },
}))

describe('StorePanel', () => {
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mcpsFixture = []
    mockInstall.mockResolvedValue(undefined)
    mockUninstall.mockResolvedValue(undefined)
    mockIsInstalled.mockReturnValue(false)
  })

  it('renders a row for every catalog entry on the MCP tab', () => {
    render(<StorePanel onClose={onClose} />)
    for (const entry of MCP_CATALOG) {
      expect(screen.getByText(entry.name)).toBeDefined()
    }
    expect(screen.getAllByText('Install').length).toBe(MCP_CATALOG.length)
  })

  it('installs an entry when its Install button is clicked', () => {
    render(<StorePanel onClose={onClose} />)
    fireEvent.click(screen.getAllByText('Install')[0])
    expect(mockInstall).toHaveBeenCalledWith(MCP_CATALOG[0])
  })

  it('shows the installed state for an already-installed entry', () => {
    mockIsInstalled.mockImplementation((name: string) => name === MCP_CATALOG[0].name)
    render(<StorePanel onClose={onClose} />)
    expect(screen.getByText('Remove')).toBeDefined()
    expect(screen.getAllByText('Install').length).toBe(MCP_CATALOG.length - 1)
  })

  it('uninstalls via the installed row id', () => {
    mcpsFixture = [{ id: 'row-1', name: MCP_CATALOG[0].name }]
    mockIsInstalled.mockImplementation((name: string) => name === MCP_CATALOG[0].name)
    render(<StorePanel onClose={onClose} />)

    fireEvent.click(screen.getByText('Remove'))

    expect(mockUninstall).toHaveBeenCalledWith('row-1')
  })

  it('switches tabs to show placeholder content', () => {
    render(<StorePanel onClose={onClose} />)
    fireEvent.click(screen.getByText('Tools'))
    expect(screen.getByText(/Built-in tools are always available/)).toBeDefined()
  })

  it('calls onClose when the close button is clicked', () => {
    render(<StorePanel onClose={onClose} />)
    fireEvent.click(screen.getByText('✕'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
