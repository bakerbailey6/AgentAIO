import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import type { AgentRow } from '@/lib/storage'

// --- Fixtures -------------------------------------------------------------
const AGENTS: AgentRow[] = [
  { id: 'a1', name: 'Alpha', type: 'llm', modelId: 'm1', systemPrompt: '', toolIds: [], mcpIds: [], canvasX: 0, canvasY: 0, groupId: null, createdAt: 0 },
  { id: 'a2', name: 'Beta', type: 'coding-agent', modelId: 'm2', systemPrompt: '', toolIds: [], mcpIds: [], canvasX: 10, canvasY: 10, groupId: null, createdAt: 0 },
]
const MODELS = [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }]

// --- Storage mocks --------------------------------------------------------
const { mockDb, agentFindAll, modelFindAll } = vi.hoisted(() => ({
  mockDb: {},
  agentFindAll: vi.fn(),
  modelFindAll: vi.fn(),
}))

vi.mock('@/lib/storage', () => ({
  initDb: vi.fn(async () => mockDb),
  AgentRepository: vi.fn().mockImplementation(function () { return { findAll: agentFindAll } }),
}))
// page.tsx imports ModelRepository directly from this path, so mock it too.
vi.mock('@/lib/storage/repositories/models', () => ({
  ModelRepository: vi.fn().mockImplementation(function () { return { findAll: modelFindAll } }),
}))

// --- Event bus mock (drives useApprovals + useAgentCounts) ----------------
const { handlers, bus } = vi.hoisted(() => {
  const handlers = new Map<string, Set<(e: unknown) => void>>()
  const bus = {
    on: vi.fn((type: string, h: (e: unknown) => void) => {
      if (!handlers.has(type)) handlers.set(type, new Set())
      handlers.get(type)!.add(h)
      return () => handlers.get(type)!.delete(h)
    }),
    off: vi.fn(),
    emit: vi.fn((e: { type: string }) => {
      handlers.get(e.type)?.forEach((h) => h(e))
    }),
  }
  return { handlers, bus }
})
vi.mock('@/lib/event-bus', () => ({ getEventBus: vi.fn(() => bus) }))

// --- Child panel stubs (keep this test about page wiring) -----------------
vi.mock('@/components/canvas/AgentCanvas', () => ({
  AgentCanvas: (p: { agents: AgentRow[]; onOpenChat: (id: string) => void }) => (
    <div data-testid="canvas" data-count={p.agents.length} onClick={() => p.onOpenChat('a1')} />
  ),
}))
vi.mock('@/components/chat/ChatPanel', () => ({
  default: (p: { agentId: string | null; onClose: () => void }) =>
    p.agentId ? <div data-testid="chat" data-agent={p.agentId}><button aria-label="close-chat" onClick={p.onClose} /></div> : null,
}))
vi.mock('@/components/settings/SettingsPanel', () => ({
  default: (p: { onClose: () => void }) => (
    <div data-testid="settings"><button aria-label="close-settings" onClick={p.onClose} /></div>
  ),
}))
vi.mock('@/components/store/StorePanel', () => ({
  StorePanel: (p: { onClose: () => void }) => (
    <div data-testid="store"><button aria-label="close-store" onClick={p.onClose} /></div>
  ),
}))
vi.mock('@/components/agents/CreateAgentPanel', () => ({
  default: (p: { open: boolean }) => (p.open ? <div data-testid="create-agent" /> : null),
}))

import Home from '../page'

describe('Home (page.tsx) integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    handlers.clear()
    agentFindAll.mockResolvedValue(AGENTS)
    modelFindAll.mockResolvedValue(MODELS)
  })

  it('loads agents on mount and passes them to the canvas', async () => {
    render(<Home />)
    await waitFor(() => expect(screen.getByTestId('canvas')).toHaveAttribute('data-count', '2'))
    expect(agentFindAll).toHaveBeenCalled()
  })

  it('reflects the model count in the status bar', async () => {
    render(<Home />)
    await waitFor(() => expect(screen.getByText(/3 models · 0 tools/)).toBeInTheDocument())
  })

  it('renders the running/idle counts from useAgentCounts at zero initially', async () => {
    render(<Home />)
    expect(screen.getByText(/0 running/)).toBeInTheDocument()
    expect(screen.getByText(/0 idle/)).toBeInTheDocument()
  })

  it('updates running count when a status-changed event is emitted', async () => {
    render(<Home />)
    await waitFor(() => expect(screen.getByTestId('canvas')).toBeInTheDocument())
    act(() => {
      bus.emit({ type: 'agent:status-changed', agentId: 'a1', status: 'running', timestamp: 0 } as never)
    })
    await waitFor(() => expect(screen.getByText(/1 running/)).toBeInTheDocument())
  })

  it('does not render side panels by default', () => {
    render(<Home />)
    expect(screen.queryByTestId('settings')).not.toBeInTheDocument()
    expect(screen.queryByTestId('store')).not.toBeInTheDocument()
    expect(screen.queryByTestId('chat')).not.toBeInTheDocument()
    expect(screen.queryByTestId('create-agent')).not.toBeInTheDocument()
  })

  it('opens and closes the Settings panel via the sidebar', async () => {
    render(<Home />)
    fireEvent.click(screen.getByLabelText('Settings'))
    expect(screen.getByTestId('settings')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('close-settings'))
    await waitFor(() => expect(screen.queryByTestId('settings')).not.toBeInTheDocument())
  })

  it('opens and closes the Store panel via the sidebar', async () => {
    render(<Home />)
    fireEvent.click(screen.getByLabelText('Store'))
    expect(screen.getByTestId('store')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('close-store'))
    await waitFor(() => expect(screen.queryByTestId('store')).not.toBeInTheDocument())
  })

  it('opens the Create Agent panel from the + New Agent button', () => {
    render(<Home />)
    expect(screen.queryByTestId('create-agent')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('+ New Agent'))
    expect(screen.getByTestId('create-agent')).toBeInTheDocument()
  })

  it('routes to chat when the canvas requests a chat, and clears it on close', async () => {
    render(<Home />)
    await waitFor(() => expect(screen.getByTestId('canvas')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('canvas'))
    const chat = await screen.findByTestId('chat')
    expect(chat).toHaveAttribute('data-agent', 'a1')
    fireEvent.click(screen.getByLabelText('close-chat'))
    await waitFor(() => expect(screen.queryByTestId('chat')).not.toBeInTheDocument())
  })

  it('shows the approval indicator when an approval is requested', async () => {
    render(<Home />)
    await waitFor(() => expect(screen.getByTestId('canvas')).toBeInTheDocument())
    act(() => {
      bus.emit({
        type: 'agent:approval-requested',
        agentId: 'a1',
        timestamp: 0,
        request: { id: 'req1', agentId: 'a1', toolName: 't', input: {}, timestamp: 0 },
      } as never)
    })
    await waitFor(() => expect(screen.getByText(/approval needed/i)).toBeInTheDocument())
  })
})
