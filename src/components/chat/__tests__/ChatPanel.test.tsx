import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ChatPanel from '../ChatPanel'
import type { ChatMessage } from '@/lib/chat/types'

const { mockRun, mockApprove, mockDeny, mockDb, emitSpy, busOn, busEmit } = vi.hoisted(() => {
  const mockDb = { execute: vi.fn(async () => ({ rowsAffected: 1 })), select: vi.fn(async () => []) }
  const mockRun = vi.fn(async function* (): AsyncGenerator<import('@/lib/interfaces').AgentEvent> {
    yield { type: 'text-delta', agentId: 'a1', timestamp: Date.now(), payload: { delta: 'Hello!' } }
    yield { type: 'status-change', agentId: 'a1', timestamp: Date.now(), payload: { status: 'idle' } }
  })
  const mockApprove = vi.fn(async () => undefined)
  const mockDeny = vi.fn(async () => undefined)

  // Functional pub/sub so useApprovals actually receives emitted events. We keep
  // an `emit` spy on top of it so existing emit assertions still see calls.
  type Handler = (event: unknown) => void
  const listeners = new Map<string, Set<Handler>>()
  const busOn = vi.fn((type: string, handler: Handler) => {
    if (!listeners.has(type)) listeners.set(type, new Set())
    listeners.get(type)!.add(handler)
    return () => listeners.get(type)?.delete(handler)
  })
  const emitSpy = vi.fn()
  const busEmit = (event: { type: string; [k: string]: unknown }) => {
    emitSpy(event)
    listeners.get(event.type)?.forEach((h) => h(event))
  }
  return { mockRun, mockApprove, mockDeny, mockDb, emitSpy, busOn, busEmit }
})

vi.mock('@tauri-apps/plugin-sql', () => ({ default: { load: vi.fn(async () => mockDb) } }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => null) }))

vi.mock('@/lib/agents/registry', () => ({
  AGENT_REGISTRY: new Map([
    ['llm', { run: mockRun, approve: mockApprove, deny: mockDeny }],
  ]),
  resolveAgentRuntimeType: (t: string) => t,
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
  getEventBus: vi.fn(() => ({ emit: busEmit, on: busOn, off: vi.fn() })),
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

  it('shows a visible error message when the run yields an error event', async () => {
    mockRun.mockImplementationOnce(async function* (): AsyncGenerator<import('@/lib/interfaces').AgentEvent> {
      yield { type: 'error', agentId: 'a1', timestamp: Date.now(), payload: { message: 'API key for "anthropic" not found — re-add it in Settings.' } }
      yield { type: 'status-change', agentId: 'a1', timestamp: Date.now(), payload: { status: 'error' } }
    })
    render(<ChatPanel agentId="a1" onClose={onClose} />)
    await waitFor(() => screen.getByPlaceholderText(/send a message/i))
    fireEvent.change(screen.getByPlaceholderText(/send a message/i), { target: { value: 'Hello' } })
    fireEvent.click(screen.getByLabelText('Send'))
    await waitFor(() => expect(screen.getByText(/Error: API key for "anthropic" not found/i)).toBeDefined())
  })

  it('renders a tool row and emits an agent:action when the run yields tool events', async () => {
    mockRun.mockImplementationOnce(async function* (): AsyncGenerator<import('@/lib/interfaces').AgentEvent> {
      yield { type: 'tool-call', agentId: 'a1', timestamp: Date.now(), payload: { toolCallId: 'tc1', toolName: 'shell', input: { cmd: 'ls' } } }
      yield { type: 'tool-result', agentId: 'a1', timestamp: Date.now(), payload: { toolCallId: 'tc1', toolName: 'shell', output: 'a.txt\nb.txt' } }
      yield { type: 'status-change', agentId: 'a1', timestamp: Date.now(), payload: { status: 'idle' } }
    })
    render(<ChatPanel agentId="a1" onClose={onClose} />)
    await waitFor(() => screen.getByPlaceholderText(/send a message/i))
    fireEvent.change(screen.getByPlaceholderText(/send a message/i), { target: { value: 'run ls' } })
    fireEvent.click(screen.getByLabelText('Send'))

    // The tool name shows up in a muted tool row.
    await waitFor(() => expect(screen.getByText(/shell/i)).toBeInTheDocument())
    // An agent:action event with action 'tool' was emitted for the tool activity.
    await waitFor(() =>
      expect(emitSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'agent:action', action: 'tool', detail: 'shell' }),
      ),
    )
  })

  it('renders an approval gate and approves via the provider', async () => {
    render(<ChatPanel agentId="a1" onClose={onClose} />)
    await waitFor(() => screen.getByPlaceholderText(/send a message/i))

    // The LLM runtime emits the approval request directly on the bus.
    busEmit({
      type: 'agent:approval-requested',
      request: { id: 'req1', agentId: 'a1', action: 'shell: rm -rf', description: 'Delete files', risk: 'high' },
      timestamp: Date.now(),
    })

    await waitFor(() => expect(screen.getByText('shell: rm -rf')).toBeInTheDocument())
    fireEvent.click(screen.getByText(/Approve/i))
    expect(mockApprove).toHaveBeenCalledWith('req1')
  })

  it('denies an approval request via the provider', async () => {
    render(<ChatPanel agentId="a1" onClose={onClose} />)
    await waitFor(() => screen.getByPlaceholderText(/send a message/i))

    busEmit({
      type: 'agent:approval-requested',
      request: { id: 'req2', agentId: 'a1', action: 'shell: curl', description: 'Network call', risk: 'medium' },
      timestamp: Date.now(),
    })

    await waitFor(() => screen.getByText('shell: curl'))
    fireEvent.click(screen.getByText(/Deny/i))
    expect(mockDeny).toHaveBeenCalledWith('req2')
  })

  it('does not render approval gates for a different agent', async () => {
    render(<ChatPanel agentId="a1" onClose={onClose} />)
    await waitFor(() => screen.getByPlaceholderText(/send a message/i))

    busEmit({
      type: 'agent:approval-requested',
      request: { id: 'req3', agentId: 'other-agent', action: 'shell: other', description: 'Other agent', risk: 'low' },
      timestamp: Date.now(),
    })

    // Give the hook a tick; the gate must not appear for a non-matching agent.
    await waitFor(() => screen.getByPlaceholderText(/send a message/i))
    expect(screen.queryByText('shell: other')).toBeNull()
  })

  it('calls onClose when X is clicked', async () => {
    render(<ChatPanel agentId="a1" onClose={onClose} />)
    await waitFor(() => screen.getByLabelText('Close chat'))
    fireEvent.click(screen.getByLabelText('Close chat'))
    expect(onClose).toHaveBeenCalled()
  })
})
