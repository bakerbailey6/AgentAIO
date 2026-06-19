import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import type { NodeProps } from 'reactflow'
import type { ApprovalRequest } from '@/lib/interfaces'
import type { ActionEntry } from '@/hooks/useAgentActions'

// --- mocks (hoisted, before importing the component under test) ---
const { mockBus, approveSpy, denySpy } = vi.hoisted(() => ({
  mockBus: { on: vi.fn(() => vi.fn()), off: vi.fn(), emit: vi.fn() },
  approveSpy: vi.fn(),
  denySpy: vi.fn(),
}))

vi.mock('reactflow', () => ({
  Handle: () => null,
  Position: { Left: 'left', Right: 'right' },
}))
vi.mock('@/lib/event-bus', () => ({ getEventBus: () => mockBus }))
vi.mock('@/lib/agents/registry', () => ({
  AGENT_REGISTRY: new Map([['llm', { approve: approveSpy, deny: denySpy }]]),
  resolveAgentRuntimeType: (t: string) => t,
}))

const approvalsMock = vi.fn<() => ApprovalRequest[]>(() => [])
const actionsMock = vi.fn<(id: string) => ActionEntry[]>(() => [])
vi.mock('@/hooks/useApprovals', () => ({ useApprovals: () => approvalsMock() }))
vi.mock('@/hooks/useAgentActions', () => ({ useAgentActions: (id: string) => actionsMock(id) }))

import { AgentCardNode, type AgentNodeData } from '../AgentCardNode'

function renderNode(over: Partial<AgentNodeData> = {}) {
  const data: AgentNodeData = {
    label: 'Coder',
    agentId: 'a1',
    name: 'Coder',
    icon: '🧑‍💻',
    modelName: 'claude-sonnet-4-6',
    toolCount: 3,
    agentType: 'llm',
    onOpenChat: vi.fn(),
    ...over,
  }
  const props = { data } as unknown as NodeProps<AgentNodeData>
  return { data, ...render(<AgentCardNode {...props} />) }
}

const approval = (over: Partial<ApprovalRequest> = {}): ApprovalRequest => ({
  id: 'req1',
  agentId: 'a1',
  action: 'Run shell command',
  description: 'rm -rf build',
  risk: 'high',
  ...over,
})

beforeEach(() => {
  approvalsMock.mockReturnValue([])
  actionsMock.mockReturnValue([])
  vi.clearAllMocks()
})

describe('AgentCardNode', () => {
  it('renders the wrapped AgentCard with the agent name and model', () => {
    renderNode()
    expect(screen.getByText('Coder')).toBeInTheDocument()
    expect(screen.getByText(/claude-sonnet-4-6/)).toBeInTheDocument()
  })

  it('maps raw agent actions into ActionEntry rows shown in the card', () => {
    actionsMock.mockReturnValue([
      { action: 'tool-call', detail: 'Reading foo.ts', timestamp: 111 },
      { action: 'tool-call', detail: 'Writing bar.ts', timestamp: 222 },
    ])
    renderNode()
    expect(screen.getByText(/Reading foo.ts/)).toBeInTheDocument()
    expect(screen.getByText(/Writing bar.ts/)).toBeInTheDocument()
  })

  it('only shows approvals belonging to this agent', () => {
    approvalsMock.mockReturnValue([
      approval({ id: 'mine', agentId: 'a1', action: 'My approval' }),
      approval({ id: 'other', agentId: 'a2', action: 'Other approval' }),
    ])
    renderNode({ agentId: 'a1' })
    expect(screen.getByText('My approval')).toBeInTheDocument()
    expect(screen.queryByText('Other approval')).not.toBeInTheDocument()
  })

  it('approving resolves via the provider and emits agent:approval-resolved', () => {
    approvalsMock.mockReturnValue([approval({ id: 'req1' })])
    renderNode()

    fireEvent.click(screen.getByText('✓ Approve'))

    expect(approveSpy).toHaveBeenCalledWith('req1')
    expect(mockBus.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'agent:approval-resolved',
        requestId: 'req1',
        approved: true,
      }),
    )
  })

  it('denying resolves via the provider and emits with approved=false', () => {
    approvalsMock.mockReturnValue([approval({ id: 'req1' })])
    renderNode()

    fireEvent.click(screen.getByText('✕ Deny'))

    expect(denySpy).toHaveBeenCalledWith('req1')
    expect(mockBus.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'agent:approval-resolved',
        requestId: 'req1',
        approved: false,
      }),
    )
  })

  it('opens chat on double-click of the card', () => {
    const onOpenChat = vi.fn()
    renderNode({ onOpenChat })
    fireEvent.doubleClick(screen.getByText('Coder'))
    expect(onOpenChat).toHaveBeenCalled()
  })
})
