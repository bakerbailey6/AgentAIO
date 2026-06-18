import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ChatPanel from '../ChatPanel'
import type { ChatMessage } from '@/lib/chat/types'

const { mockRun, mockDb } = vi.hoisted(() => {
  const mockDb = { execute: vi.fn(async () => ({ rowsAffected: 1 })), select: vi.fn(async () => []) }
  const mockRun = vi.fn(async function* () {
    yield { type: 'text-delta', agentId: 'a1', timestamp: Date.now(), payload: { delta: 'Hello!' } }
    yield { type: 'status-change', agentId: 'a1', timestamp: Date.now(), payload: { status: 'idle' } }
  })
  return { mockRun, mockDb }
})

vi.mock('@tauri-apps/plugin-sql', () => ({ default: { load: vi.fn(async () => mockDb) } }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => null) }))

vi.mock('@/lib/agents/registry', () => ({
  AGENT_REGISTRY: new Map([
    ['llm', { run: mockRun }],
  ]),
}))

vi.mock('@/lib/storage', () => ({
  initDb: vi.fn(async () => mockDb),
  AgentRepository: vi.fn().mockImplementation(function() {
    return {
      findById: vi.fn(async () => ({
        id: 'a1', name: 'Test Bot', type: 'llm', modelId: 'model-1',
        systemPrompt: '', toolIds: [], mcpIds: [], canvasX: 0, canvasY: 0, groupId: null, createdAt: 0,
      })),
    }
  }),
  SessionRepository: vi.fn().mockImplementation(function() {
    return {
      findByAgentId: vi.fn(async () => []),
      create: vi.fn(async () => 'session-1'),
      updateMessages: vi.fn(async () => undefined),
    }
  }),
}))

vi.mock('@/lib/event-bus', () => ({
  getEventBus: vi.fn(() => ({ emit: vi.fn(), on: vi.fn(() => () => {}), off: vi.fn() })),
}))

describe('ChatPanel', () => {
  const onClose = vi.fn()
  beforeEach(() => vi.clearAllMocks())

  it('renders null when agentId is null', () => {
    const { container } = render(<ChatPanel agentId={null} onClose={onClose} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows empty state for new agent', async () => {
    render(<ChatPanel agentId="a1" onClose={onClose} />)
    await waitFor(() => expect(screen.getByText(/send a message/i)).toBeDefined())
  })

  it('shows agent name in header', async () => {
    render(<ChatPanel agentId="a1" onClose={onClose} />)
    await waitFor(() => expect(screen.getByText('Test Bot')).toBeDefined())
  })

  it('calls provider.run on submit', async () => {
    render(<ChatPanel agentId="a1" onClose={onClose} />)
    await waitFor(() => screen.getByPlaceholderText(/send a message/i))
    fireEvent.change(screen.getByPlaceholderText(/send a message/i), { target: { value: 'Hello' } })
    fireEvent.click(screen.getByLabelText('Send'))
    await waitFor(() => expect(mockRun).toHaveBeenCalled())
  })

  it('calls onClose when X is clicked', async () => {
    render(<ChatPanel agentId="a1" onClose={onClose} />)
    await waitFor(() => screen.getByLabelText('Close chat'))
    fireEvent.click(screen.getByLabelText('Close chat'))
    expect(onClose).toHaveBeenCalled()
  })
})
