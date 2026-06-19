import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockDb, mockFindAll, mockUpdateToolIds, mockUpdateMcpIds } = vi.hoisted(() => ({
  mockDb: {},
  mockFindAll: vi.fn(),
  mockUpdateToolIds: vi.fn(),
  mockUpdateMcpIds: vi.fn(),
}))

vi.mock('@/lib/storage', () => {
  class AgentRepository {
    findAll = mockFindAll
    updateToolIds = mockUpdateToolIds
    updateMcpIds = mockUpdateMcpIds
  }
  return { initDb: vi.fn().mockResolvedValue(mockDb), AgentRepository }
})

import { useAgentAssignments } from '../useAgentAssignments'

const agent = (id: string, name: string, toolIds: string[] = [], mcpIds: string[] = []) => ({
  id,
  name,
  type: 'llm' as const,
  modelId: null,
  systemPrompt: '',
  toolIds,
  mcpIds,
  canvasX: 0,
  canvasY: 0,
  groupId: null,
  createdAt: 0,
})

describe('useAgentAssignments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindAll.mockResolvedValue([])
    mockUpdateToolIds.mockResolvedValue(undefined)
    mockUpdateMcpIds.mockResolvedValue(undefined)
  })

  it('loads agents on mount', async () => {
    mockFindAll.mockResolvedValue([agent('a1', 'One')])
    const { result } = renderHook(() => useAgentAssignments())
    await waitFor(() => expect(result.current.agents).toHaveLength(1))
  })

  it('toggle adds an item id to an agent and persists it', async () => {
    mockFindAll.mockResolvedValue([agent('a1', 'One', ['existing'])])
    const { result } = renderHook(() => useAgentAssignments())
    await waitFor(() => expect(result.current.agents).toHaveLength(1))

    await act(async () => {
      await result.current.toggle('web_search', 'a1', true)
    })

    expect(mockUpdateToolIds).toHaveBeenCalledWith('a1', ['existing', 'web_search'])
    expect(result.current.assignedAgentIds('web_search')).toEqual(['a1'])
    expect(result.current.assignedAgentNames('web_search')).toEqual(['One'])
  })

  it('toggle removes an item id when assigned=false', async () => {
    mockFindAll.mockResolvedValue([agent('a1', 'One', ['web_search', 'keep'])])
    const { result } = renderHook(() => useAgentAssignments())
    await waitFor(() => expect(result.current.agents).toHaveLength(1))

    await act(async () => {
      await result.current.toggle('web_search', 'a1', false)
    })

    expect(mockUpdateToolIds).toHaveBeenCalledWith('a1', ['keep'])
    expect(result.current.assignedAgentIds('web_search')).toEqual([])
  })

  it("toggle with kind='mcp' adds an mcp id and persists via updateMcpIds", async () => {
    mockFindAll.mockResolvedValue([agent('a1', 'One', [], ['existing-mcp'])])
    const { result } = renderHook(() => useAgentAssignments())
    await waitFor(() => expect(result.current.agents).toHaveLength(1))

    await act(async () => {
      await result.current.toggle('mcp-row-1', 'a1', true, 'mcp')
    })

    expect(mockUpdateMcpIds).toHaveBeenCalledWith('a1', ['existing-mcp', 'mcp-row-1'])
    expect(mockUpdateToolIds).not.toHaveBeenCalled()
    expect(result.current.assignedAgentIds('mcp-row-1', 'mcp')).toEqual(['a1'])
    expect(result.current.assignedAgentNames('mcp-row-1', 'mcp')).toEqual(['One'])
  })

  it("toggle with kind='mcp' removes an mcp id when assigned=false", async () => {
    mockFindAll.mockResolvedValue([agent('a1', 'One', [], ['mcp-row-1', 'keep-mcp'])])
    const { result } = renderHook(() => useAgentAssignments())
    await waitFor(() => expect(result.current.agents).toHaveLength(1))

    await act(async () => {
      await result.current.toggle('mcp-row-1', 'a1', false, 'mcp')
    })

    expect(mockUpdateMcpIds).toHaveBeenCalledWith('a1', ['keep-mcp'])
    expect(result.current.assignedAgentIds('mcp-row-1', 'mcp')).toEqual([])
  })
})
