import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CreateAgentPanel from '../CreateAgentPanel'
import { ModelRepository } from '@/lib/storage'

const mockDb = {
  execute: vi.fn(async () => ({ rowsAffected: 1 })),
  select: vi.fn(async () => []),
}
vi.mock('@tauri-apps/plugin-sql', () => ({
  default: { load: vi.fn(async () => mockDb) },
}))

const mockRow = {
  id: 'agent-1', name: 'Test Bot', type: 'llm' as const,
  modelId: 'model-1', systemPrompt: '', toolIds: [], mcpIds: [],
  canvasX: 120, canvasY: 120, groupId: null, createdAt: 0,
}

vi.mock('@/lib/storage', () => ({
  initDb: vi.fn(async () => mockDb),
  AgentRepository: vi.fn(function () {
    return {
      create: vi.fn(async () => 'agent-1'),
      findAll: vi.fn(async () => []),
      findById: vi.fn(async () => mockRow),
    }
  }),
  ModelRepository: vi.fn(function () {
    return {
      findAll: vi.fn(async () => [{
        id: 'model-1', provider: 'anthropic', modelName: 'claude-sonnet-4-6',
        displayName: 'Claude Sonnet', apiKeyRef: 'anthropic-key', baseUrl: null, createdAt: 0,
      }]),
    }
  }),
}))

describe('CreateAgentPanel', () => {
  const onClose = vi.fn()
  const onCreated = vi.fn()
  beforeEach(() => vi.clearAllMocks())

  it('renders when open', () => {
    render(<CreateAgentPanel open={true} onClose={onClose} onCreated={onCreated} />)
    expect(screen.getByText('New Agent')).toBeDefined()
  })

  it('renders null when closed', () => {
    const { container } = render(<CreateAgentPanel open={false} onClose={onClose} onCreated={onCreated} />)
    expect(container.firstChild).toBeNull()
  })

  it('calls onCreated and onClose after submit', async () => {
    render(<CreateAgentPanel open={true} onClose={onClose} onCreated={onCreated} />)
    fireEvent.change(screen.getByPlaceholderText(/agent name/i), { target: { value: 'Test Bot' } })
    fireEvent.click(screen.getByText('Create'))
    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(mockRow)
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('routes to Settings when the empty-model link is clicked', async () => {
    // No models configured → the LLM type shows the "add one in Settings" link.
    // Mock-with-`new` must be a `function` (never an arrow), or it is "not a constructor".
    vi.mocked(ModelRepository).mockImplementationOnce(function () {
      return { findAll: vi.fn(async () => []) } as unknown as ModelRepository
    })
    const onNavigateToSettings = vi.fn()
    render(
      <CreateAgentPanel
        open={true}
        onClose={onClose}
        onCreated={onCreated}
        onNavigateToSettings={onNavigateToSettings}
      />,
    )
    const link = await screen.findByText(/add one in settings/i)
    fireEvent.click(link)
    expect(onNavigateToSettings).toHaveBeenCalledTimes(1)
  })
})
