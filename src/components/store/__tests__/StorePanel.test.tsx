import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StorePanel } from '../StorePanel'
import { MCP_CATALOG } from '@/lib/store/catalog'
import { listBuiltInTools } from '@/lib/tools/registry'
import type { Skill } from '@/lib/skills'

const {
  mockInstall,
  mockUninstall,
  mockIsInstalled,
  mockMcpInstalledId,
  mockToolInstall,
  mockToolUninstall,
  mockToolIsInstalled,
  mockToolInstalledId,
  mockSkillCreate,
  mockToggle,
  mockAssignedAgentIds,
  mockAssignedAgentNames,
} = vi.hoisted(() => ({
  mockInstall: vi.fn(),
  mockUninstall: vi.fn(),
  mockIsInstalled: vi.fn(),
  mockMcpInstalledId: vi.fn(),
  mockToolInstall: vi.fn(),
  mockToolUninstall: vi.fn(),
  mockToolIsInstalled: vi.fn(),
  mockToolInstalledId: vi.fn(),
  mockSkillCreate: vi.fn(),
  mockToggle: vi.fn(),
  mockAssignedAgentIds: vi.fn(),
  mockAssignedAgentNames: vi.fn(),
}))

let mcpsFixture: Array<{ id: string; name: string }> = []
let skillsFixture: Skill[] = []
let agentsFixture: Array<{ id: string; name: string; toolIds: string[] }> = []

vi.mock('@/hooks/useInstalledMcps', () => ({
  useInstalledMcps: () => ({
    mcps: mcpsFixture,
    install: mockInstall,
    uninstall: mockUninstall,
    isInstalled: mockIsInstalled,
    installedId: mockMcpInstalledId,
  }),
}))
vi.mock('@/hooks/useInstalledTools', () => ({
  useInstalledTools: () => ({
    tools: [],
    install: mockToolInstall,
    uninstall: mockToolUninstall,
    isInstalled: mockToolIsInstalled,
    installedId: mockToolInstalledId,
  }),
}))
vi.mock('@/hooks/useSkills', () => ({
  useSkills: () => ({ skills: skillsFixture, create: mockSkillCreate, refresh: vi.fn() }),
}))
vi.mock('@/hooks/useAgentAssignments', () => ({
  useAgentAssignments: () => ({
    agents: agentsFixture,
    toggle: mockToggle,
    assignedAgentIds: mockAssignedAgentIds,
    assignedAgentNames: mockAssignedAgentNames,
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
    skillsFixture = []
    agentsFixture = []
    mockInstall.mockResolvedValue(undefined)
    mockUninstall.mockResolvedValue(undefined)
    mockIsInstalled.mockReturnValue(false)
    mockMcpInstalledId.mockReturnValue(undefined)
    mockToolInstall.mockResolvedValue('tool-row-1')
    mockToolUninstall.mockResolvedValue(undefined)
    mockToolIsInstalled.mockReturnValue(false)
    mockToolInstalledId.mockReturnValue(undefined)
    mockSkillCreate.mockResolvedValue(undefined)
    mockToggle.mockResolvedValue(undefined)
    mockAssignedAgentIds.mockReturnValue([])
    mockAssignedAgentNames.mockReturnValue([])
  })

  // --- MCP tab (unchanged behavior) ---

  it('renders a row for every catalog entry on the MCP tab', () => {
    render(<StorePanel onClose={onClose} />)
    for (const entry of MCP_CATALOG) {
      expect(screen.getByText(entry.name)).toBeDefined()
    }
  })

  it('installs an MCP entry when its Install button is clicked', () => {
    render(<StorePanel onClose={onClose} />)
    fireEvent.click(screen.getAllByText('Install')[0])
    expect(mockInstall).toHaveBeenCalledWith(MCP_CATALOG[0])
  })

  it('uninstalls via the installed MCP row id', () => {
    mcpsFixture = [{ id: 'row-1', name: MCP_CATALOG[0].name }]
    mockIsInstalled.mockImplementation((name: string) => name === MCP_CATALOG[0].name)
    render(<StorePanel onClose={onClose} />)
    fireEvent.click(screen.getByText('Remove'))
    expect(mockUninstall).toHaveBeenCalledWith('row-1')
  })

  it('assigns an installed MCP server to an agent via mcp_ids', () => {
    // First catalog entry reads as installed with a known row id.
    const firstName = MCP_CATALOG[0].name
    mockIsInstalled.mockImplementation((name: string) => name === firstName)
    mockMcpInstalledId.mockImplementation((name: string) => (name === firstName ? 'mcp-row-1' : undefined))
    agentsFixture = [{ id: 'agent-1', name: 'Researcher', toolIds: [] }]

    render(<StorePanel onClose={onClose} />)
    fireEvent.click(screen.getByText('Assign ▾'))
    fireEvent.click(screen.getByLabelText('Researcher'))

    expect(mockToggle).toHaveBeenCalledWith('mcp-row-1', 'agent-1', true, 'mcp')
  })

  // --- Tools tab ---

  it('lists every built-in tool on the Tools tab', () => {
    render(<StorePanel onClose={onClose} />)
    fireEvent.click(screen.getByText('Tools'))
    for (const tool of listBuiltInTools()) {
      expect(screen.getByText(tool.name)).toBeDefined()
    }
  })

  it('installs a built-in tool by its ToolDefinition', () => {
    render(<StorePanel onClose={onClose} />)
    fireEvent.click(screen.getByText('Tools'))
    fireEvent.click(screen.getAllByText('Install')[0])
    expect(mockToolInstall).toHaveBeenCalledTimes(1)
    expect(mockToolInstall.mock.calls[0][0].name).toBe(listBuiltInTools()[0].name)
  })

  it('assigns an installed tool to an agent via tool_ids', () => {
    // First built-in tool reads as installed with a known row id.
    const firstName = listBuiltInTools()[0].name
    mockToolIsInstalled.mockImplementation((name: string) => name === firstName)
    mockToolInstalledId.mockImplementation((name: string) => (name === firstName ? 'tool-row-1' : undefined))
    agentsFixture = [{ id: 'agent-1', name: 'Researcher', toolIds: [] }]

    render(<StorePanel onClose={onClose} />)
    fireEvent.click(screen.getByText('Tools'))
    fireEvent.click(screen.getByText('Assign ▾'))
    fireEvent.click(screen.getByLabelText('Researcher'))

    expect(mockToggle).toHaveBeenCalledWith('tool-row-1', 'agent-1', true)
  })

  // --- Skills tab ---

  it('shows the empty state when no skills are present', () => {
    render(<StorePanel onClose={onClose} />)
    fireEvent.click(screen.getByText('Skills'))
    expect(screen.getByText(/No skills in ~\/.acc\/skills yet/)).toBeDefined()
  })

  it('lists dropped-in skills and assigns one to an agent via a skill: id', () => {
    skillsFixture = [
      {
        fileName: 'code-review.md',
        name: 'Code Review',
        description: 'Reviews a diff',
        version: '2.0.0',
        frontmatter: {},
        body: '',
      },
    ]
    agentsFixture = [{ id: 'agent-1', name: 'Researcher', toolIds: [] }]

    render(<StorePanel onClose={onClose} />)
    fireEvent.click(screen.getByText('Skills'))
    expect(screen.getByText('Code Review')).toBeDefined()

    fireEvent.click(screen.getByText('Assign ▾'))
    fireEvent.click(screen.getByLabelText('Researcher'))

    expect(mockToggle).toHaveBeenCalledWith('skill:code-review.md', 'agent-1', true)
  })

  it('creates a skill file from the footer (defaulting the .md extension)', () => {
    render(<StorePanel onClose={onClose} />)
    fireEvent.click(screen.getByText('Skills'))
    fireEvent.change(screen.getByPlaceholderText('my-skill.md'), { target: { value: 'greeter' } })
    fireEvent.click(screen.getByText('Create'))
    expect(mockSkillCreate).toHaveBeenCalledTimes(1)
    expect(mockSkillCreate.mock.calls[0][0]).toBe('greeter.md')
    expect(mockSkillCreate.mock.calls[0][1]).toContain('name: greeter')
  })

  it('calls onClose when the close button is clicked', () => {
    render(<StorePanel onClose={onClose} />)
    fireEvent.click(screen.getByText('✕'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
