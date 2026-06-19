import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockDb, mockFindAll, mockCreate, mockDelete } = vi.hoisted(() => {
  const mockDb = {}
  const mockFindAll = vi.fn()
  const mockCreate = vi.fn()
  const mockDelete = vi.fn()
  return { mockDb, mockFindAll, mockCreate, mockDelete }
})

vi.mock('@/lib/storage', () => {
  class McpRepository {
    findAll = mockFindAll
    create = mockCreate
    delete = mockDelete
  }
  return {
    initDb: vi.fn().mockResolvedValue(mockDb),
    McpRepository,
  }
})

import { useInstalledMcps } from '../useInstalledMcps'

describe('useInstalledMcps', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindAll.mockResolvedValue([])
    mockCreate.mockResolvedValue('new-id')
    mockDelete.mockResolvedValue(undefined)
  })

  it('starts with empty list, calls findAll on mount', async () => {
    mockFindAll.mockResolvedValue([])

    const { result } = renderHook(() => useInstalledMcps())

    await waitFor(() => {
      expect(mockFindAll).toHaveBeenCalledTimes(1)
    })

    expect(result.current.mcps).toEqual([])
  })

  it('install calls create and appends to state', async () => {
    mockFindAll.mockResolvedValue([])
    mockCreate.mockResolvedValue('test-id')

    const { result } = renderHook(() => useInstalledMcps())

    await waitFor(() => {
      expect(mockFindAll).toHaveBeenCalledTimes(1)
    })

    await act(async () => {
      await result.current.install({
        name: 'test-mcp',
        description: '',
        version: '1.0.0',
        transport: 'stdio',
        commandTemplate: 'npx test-mcp',
      })
    })

    expect(mockCreate).toHaveBeenCalledWith({
      name: 'test-mcp',
      transport: 'stdio',
      commandOrUrl: 'npx test-mcp',
      envVarsRef: [],
      enabled: true,
    })

    expect(result.current.mcps).toHaveLength(1)
    expect(result.current.mcps[0].name).toBe('test-mcp')
  })

  it('uninstall calls delete and removes from state', async () => {
    const existingRow = {
      id: 'row-1',
      name: 'test-mcp',
      transport: 'stdio' as const,
      commandOrUrl: 'npx test-mcp',
      envVarsRef: [],
      enabled: true,
      createdAt: 0,
    }
    mockFindAll.mockResolvedValue([existingRow])

    const { result } = renderHook(() => useInstalledMcps())

    await waitFor(() => {
      expect(result.current.mcps).toHaveLength(1)
    })

    await act(async () => {
      await result.current.uninstall('row-1')
    })

    expect(mockDelete).toHaveBeenCalledWith('row-1')
    expect(result.current.mcps).toHaveLength(0)
  })

  it('isInstalled returns true for installed name, false otherwise', async () => {
    const existingRow = {
      id: 'row-1',
      name: 'installed-mcp',
      transport: 'stdio' as const,
      commandOrUrl: 'npx installed-mcp',
      envVarsRef: [],
      enabled: true,
      createdAt: 0,
    }
    mockFindAll.mockResolvedValue([existingRow])

    const { result } = renderHook(() => useInstalledMcps())

    await waitFor(() => {
      expect(result.current.mcps).toHaveLength(1)
    })

    expect(result.current.isInstalled('installed-mcp')).toBe(true)
    expect(result.current.isInstalled('other-mcp')).toBe(false)
  })

  it('installedId returns the row id for a known name and undefined otherwise', async () => {
    const existingRow = {
      id: 'row-1',
      name: 'installed-mcp',
      transport: 'stdio' as const,
      commandOrUrl: 'npx installed-mcp',
      envVarsRef: [],
      enabled: true,
      createdAt: 0,
    }
    mockFindAll.mockResolvedValue([existingRow])

    const { result } = renderHook(() => useInstalledMcps())

    await waitFor(() => {
      expect(result.current.mcps).toHaveLength(1)
    })

    expect(result.current.installedId('installed-mcp')).toBe('row-1')
    expect(result.current.installedId('missing-mcp')).toBeUndefined()
  })
})
