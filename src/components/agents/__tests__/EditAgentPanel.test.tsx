import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import EditAgentPanel from '../EditAgentPanel'

const mockDb = {
  execute: vi.fn(async () => ({ rowsAffected: 1 })),
  select: vi.fn(async () => []),
}
vi.mock('@tauri-apps/plugin-sql', () => ({
  default: { load: vi.fn(async () => mockDb) },
}))

const mockRow = {
  id: 'agent-1',
  name: 'Test Bot',
  type: 'llm' as const,
  modelId: 'model-1',
  systemPrompt: 'You are helpful.',
  toolIds: ['tool-1', 'skill:foo.md'],
  mcpIds: ['mcp-1'],
  canvasX: 120,
  canvasY: 120,
  groupId: null,
  createdAt: 0,
}

const spies = vi.hoisted(() => ({
  findById: vi.fn(),
  update: vi.fn(async () => {}),
  updateToolIds: vi.fn(async () => {}),
  updateMcpIds: vi.fn(async () => {}),
  modelFindAll: vi.fn(),
  toolFindAll: vi.fn(),
  mcpFindAll: vi.fn(),
  loadSkills: vi.fn(),
}))

vi.mock('@/lib/storage', () => ({
  initDb: vi.fn(async () => mockDb),
  AgentRepository: vi.fn(function () {
    return {
      findById: spies.findById,
      update: spies.update,
      updateToolIds: spies.updateToolIds,
      updateMcpIds: spies.updateMcpIds,
    }
  }),
  ModelRepository: vi.fn(function () {
    return { findAll: spies.modelFindAll }
  }),
  ToolRepository: vi.fn(function () {
    return { findAll: spies.toolFindAll }
  }),
  McpRepository: vi.fn(function () {
    return { findAll: spies.mcpFindAll }
  }),
}))

vi.mock('@/lib/skills', () => ({
  loadSkills: spies.loadSkills,
}))

describe('EditAgentPanel', () => {
  const onClose = vi.fn()
  const onSaved = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    spies.findById.mockResolvedValue(mockRow)
    spies.modelFindAll.mockResolvedValue([
      {
        id: 'model-1',
        provider: 'anthropic',
        modelName: 'claude-sonnet-4-6',
        displayName: 'Claude Sonnet',
        apiKeyRef: 'anthropic-key',
        baseUrl: null,
        createdAt: 0,
      },
    ])
    spies.toolFindAll.mockResolvedValue([
      { id: 'tool-1', name: 'Web Search', description: '', source: 'built-in', version: '1.0.0', definition: {}, createdAt: 0 },
    ])
    spies.mcpFindAll.mockResolvedValue([
      { id: 'mcp-1', name: 'Filesystem', transport: 'stdio', commandOrUrl: 'fs', envVarsRef: [], enabled: true, createdAt: 0 },
    ])
    spies.loadSkills.mockResolvedValue([
      { fileName: 'foo.md', name: 'Foo Skill', description: '', version: '1.0.0', frontmatter: {}, body: '' },
    ])
  })

  it('prefills the agent name after load', async () => {
    render(<EditAgentPanel agentId="agent-1" onClose={onClose} onSaved={onSaved} />)
    await waitFor(() => {
      expect((screen.getByPlaceholderText(/agent name/i) as HTMLInputElement).value).toBe('Test Bot')
    })
  })

  it('routes to Settings when the empty-model link is clicked', async () => {
    spies.modelFindAll.mockResolvedValue([])
    const onNavigateToSettings = vi.fn()
    render(
      <EditAgentPanel
        agentId="agent-1"
        onClose={onClose}
        onSaved={onSaved}
        onNavigateToSettings={onNavigateToSettings}
      />,
    )
    const link = await screen.findByText(/add one in settings/i)
    fireEvent.click(link)
    expect(onNavigateToSettings).toHaveBeenCalledTimes(1)
  })

  it('saves and calls onSaved with the refetched row then onClose', async () => {
    render(<EditAgentPanel agentId="agent-1" onClose={onClose} onSaved={onSaved} />)
    // Wait for initial load.
    await waitFor(() => {
      expect((screen.getByPlaceholderText(/agent name/i) as HTMLInputElement).value).toBe('Test Bot')
    })

    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(spies.update).toHaveBeenCalledWith('agent-1', {
        name: 'Test Bot',
        modelId: 'model-1',
        systemPrompt: 'You are helpful.',
        projectDirectory: null,
      })
      expect(spies.updateToolIds).toHaveBeenCalledWith('agent-1', ['tool-1', 'skill:foo.md'])
      expect(spies.updateMcpIds).toHaveBeenCalledWith('agent-1', ['mcp-1'])
      expect(onSaved).toHaveBeenCalledWith(mockRow)
      expect(onClose).toHaveBeenCalled()
    })
  })
})
