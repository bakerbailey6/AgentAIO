import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ToolContext } from '@/lib/interfaces'

const { writeTextFileMock, isTauriMock } = vi.hoisted(() => ({
  writeTextFileMock: vi.fn(),
  isTauriMock: vi.fn(() => true),
}))
vi.mock('@/lib/fs', () => ({ writeTextFile: writeTextFileMock }))
vi.mock('@/lib/platform', () => ({ isTauri: isTauriMock }))

import { FileWriteTool } from '@/lib/tools/built-in/file-write'

function ctx(allowedPaths: string[]): ToolContext {
  return {
    agentId: 'a',
    sessionId: 's',
    permissionScope: { allowedPaths, allowedDomains: [], shellEnabled: false },
  }
}

describe('FileWriteTool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isTauriMock.mockReturnValue(true)
  })

  it('rejects a path outside the allowed roots without touching the fs bridge', async () => {
    const tool = new FileWriteTool()
    await expect(
      tool.execute({ path: '/etc/cron.d/evil', contents: 'x' }, ctx(['/root'])),
    ).rejects.toThrow(/allowed paths/i)
    expect(writeTextFileMock).not.toHaveBeenCalled()
  })

  it('writes via the fs bridge when allowed, forwarding contents + allowedPaths', async () => {
    writeTextFileMock.mockResolvedValue(undefined)
    const tool = new FileWriteTool()
    await tool.execute({ path: '/root/b.txt', contents: 'hi' }, ctx(['/root']))
    expect(writeTextFileMock).toHaveBeenCalledWith('/root/b.txt', 'hi', ['/root'])
  })

  it('throws a desktop-only error in web mode (no fs call)', async () => {
    isTauriMock.mockReturnValue(false)
    const tool = new FileWriteTool()
    await expect(
      tool.execute({ path: '/root/b.txt', contents: 'hi' }, ctx(['/root'])),
    ).rejects.toThrow(/desktop app/i)
    expect(writeTextFileMock).not.toHaveBeenCalled()
  })
})
