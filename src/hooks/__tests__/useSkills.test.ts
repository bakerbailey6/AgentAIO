import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Skill } from '@/lib/skills'

const { mockLoadSkills, mockWriteSkillFile } = vi.hoisted(() => ({
  mockLoadSkills: vi.fn(),
  mockWriteSkillFile: vi.fn(),
}))

vi.mock('@/lib/skills', () => ({
  loadSkills: mockLoadSkills,
  writeSkillFile: mockWriteSkillFile,
}))

import { useSkills } from '../useSkills'

const skill = (fileName: string): Skill => ({
  fileName,
  name: fileName.replace(/\.md$/, ''),
  description: '',
  version: '1.0.0',
  frontmatter: {},
  body: '',
})

describe('useSkills', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLoadSkills.mockResolvedValue([])
    mockWriteSkillFile.mockResolvedValue(undefined)
  })

  it('loads skills on mount', async () => {
    mockLoadSkills.mockResolvedValue([skill('a.md')])
    const { result } = renderHook(() => useSkills())
    await waitFor(() => expect(result.current.skills).toHaveLength(1))
    expect(result.current.skills[0].fileName).toBe('a.md')
  })

  it('create writes the file then reloads the list', async () => {
    mockLoadSkills.mockResolvedValueOnce([]) // mount
    const { result } = renderHook(() => useSkills())
    await waitFor(() => expect(mockLoadSkills).toHaveBeenCalledTimes(1))

    mockLoadSkills.mockResolvedValueOnce([skill('new.md')]) // refresh after create
    await act(async () => {
      await result.current.create('new.md', '# new')
    })

    expect(mockWriteSkillFile).toHaveBeenCalledWith('new.md', '# new')
    await waitFor(() => expect(result.current.skills.map((s) => s.fileName)).toEqual(['new.md']))
  })

  it('tolerates a load failure (web mode) by leaving the list empty', async () => {
    mockLoadSkills.mockRejectedValue(new Error('no backend'))
    const { result } = renderHook(() => useSkills())
    await waitFor(() => expect(mockLoadSkills).toHaveBeenCalled())
    expect(result.current.skills).toEqual([])
  })
})
