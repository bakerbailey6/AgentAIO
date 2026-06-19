import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ToolContext } from '@/lib/interfaces'

const { readTextFileMock, isTauriMock } = vi.hoisted(() => ({
  readTextFileMock: vi.fn(),
  isTauriMock: vi.fn(() => true),
}))
vi.mock('@/lib/fs', () => ({ readTextFile: readTextFileMock }))
vi.mock('@/lib/platform', () => ({ isTauri: isTauriMock }))

import { FileReadTool } from '@/lib/tools/built-in/file-read'

function ctx(allowedPaths: string[]): ToolContext {
  return {
    agentId: 'a',
    sessionId: 's',
    permissionScope: { allowedPaths, allowedDomains: [], shellEnabled: false },
  }
}

describe('FileReadTool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isTauriMock.mockReturnValue(true)
  })

  it('rejects a path outside the allowed roots without touching the fs bridge', async () => {
    const tool = new FileReadTool()
    await expect(tool.execute({ path: '/etc/passwd' }, ctx(['/root']))).rejects.toThrow(/allowed paths/i)
    expect(readTextFileMock).not.toHaveBeenCalled()
  })

  it('reads via the fs bridge when allowed, forwarding allowedPaths', async () => {
    readTextFileMock.mockResolvedValue('contents')
    const tool = new FileReadTool()
    const out = await tool.execute({ path: '/root/a.txt' }, ctx(['/root']))
    expect(out).toBe('contents')
    expect(readTextFileMock).toHaveBeenCalledWith('/root/a.txt', ['/root'])
  })

  it('throws a desktop-only error in web mode (no fs call)', async () => {
    isTauriMock.mockReturnValue(false)
    const tool = new FileReadTool()
    await expect(tool.execute({ path: '/root/a.txt' }, ctx(['/root']))).rejects.toThrow(/desktop app/i)
    expect(readTextFileMock).not.toHaveBeenCalled()
  })
})
