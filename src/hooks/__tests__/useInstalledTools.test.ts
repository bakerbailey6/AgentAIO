import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ToolDefinition } from '@/lib/interfaces'

const { mockDb, mockFindAll, mockCreate, mockDelete } = vi.hoisted(() => ({
  mockDb: {},
  mockFindAll: vi.fn(),
  mockCreate: vi.fn(),
  mockDelete: vi.fn(),
}))

vi.mock('@/lib/storage', () => {
  class ToolRepository {
    findAll = mockFindAll
    create = mockCreate
    delete = mockDelete
  }
  return { initDb: vi.fn().mockResolvedValue(mockDb), ToolRepository }
})

import { useInstalledTools } from '../useInstalledTools'

const sampleTool: ToolDefinition = {
  name: 'web_search',
  description: 'search the web',
  source: 'built-in',
  version: '1.0.0',
  inputSchema: { type: 'object' },
  execute: async () => null,
}

describe('useInstalledTools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindAll.mockResolvedValue([])
    mockCreate.mockResolvedValue('new-id')
    mockDelete.mockResolvedValue(undefined)
  })

  it('loads installed tools on mount', async () => {
    const { result } = renderHook(() => useInstalledTools())
    await waitFor(() => expect(mockFindAll).toHaveBeenCalledTimes(1))
    expect(result.current.tools).toEqual([])
  })

  it('install persists the tool definition and appends it to state', async () => {
    mockCreate.mockResolvedValue('tool-1')
    const { result } = renderHook(() => useInstalledTools())
    await waitFor(() => expect(mockFindAll).toHaveBeenCalledTimes(1))

    let returnedId = ''
    await act(async () => {
      returnedId = await result.current.install(sampleTool)
    })

    expect(returnedId).toBe('tool-1')
    expect(mockCreate).toHaveBeenCalledWith({
      name: 'web_search',
      description: 'search the web',
      source: 'built-in',
      version: '1.0.0',
      definition: { inputSchema: { type: 'object' } },
    })
    expect(result.current.isInstalled('web_search')).toBe(true)
    expect(result.current.installedId('web_search')).toBe('tool-1')
  })

  it('uninstall deletes and removes from state', async () => {
    mockFindAll.mockResolvedValue([
      { id: 'tool-1', name: 'web_search', description: '', source: 'built-in', version: '1.0.0', definition: {}, createdAt: 0 },
    ])
    const { result } = renderHook(() => useInstalledTools())
    await waitFor(() => expect(result.current.tools).toHaveLength(1))

    await act(async () => {
      await result.current.uninstall('tool-1')
    })

    expect(mockDelete).toHaveBeenCalledWith('tool-1')
    expect(result.current.tools).toHaveLength(0)
  })
})
