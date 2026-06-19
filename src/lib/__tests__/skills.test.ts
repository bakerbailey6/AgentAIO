import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }))

vi.mock('@tauri-apps/api/core', () => ({ invoke: mockInvoke }))

import {
  parseFrontmatter,
  toSkill,
  listSkillFiles,
  readSkillFile,
  writeSkillFile,
  loadSkills,
} from '@/lib/skills'

describe('parseFrontmatter', () => {
  it('parses a fenced frontmatter block and returns the body', () => {
    const raw = ['---', 'name: code-review', 'description: Review a diff', 'version: 2.1.0', '---', '# Body', 'text'].join('\n')
    const { frontmatter, body } = parseFrontmatter(raw)
    expect(frontmatter).toEqual({ name: 'code-review', description: 'Review a diff', version: '2.1.0' })
    expect(body).toBe('# Body\ntext')
  })

  it('strips surrounding quotes from values and tolerates colons in values', () => {
    const raw = ['---', 'description: "a: b, see https://x.y"', "name: 'quoted'", '---', 'body'].join('\n')
    const { frontmatter } = parseFrontmatter(raw)
    expect(frontmatter.description).toBe('a: b, see https://x.y')
    expect(frontmatter.name).toBe('quoted')
  })

  it('treats a file with no opening fence as all body', () => {
    const raw = '# Just markdown\nno frontmatter'
    expect(parseFrontmatter(raw)).toEqual({ frontmatter: {}, body: raw })
  })

  it('treats an unterminated fence as all body', () => {
    const raw = '---\nname: x\nstill going'
    expect(parseFrontmatter(raw)).toEqual({ frontmatter: {}, body: raw })
  })

  it('handles CRLF line endings', () => {
    const raw = '---\r\nname: win\r\n---\r\nbody'
    const { frontmatter, body } = parseFrontmatter(raw)
    expect(frontmatter.name).toBe('win')
    expect(body).toBe('body')
  })
})

describe('toSkill', () => {
  it('maps frontmatter onto a Skill, defaulting version and falling back name', () => {
    const skill = toSkill('greeter.md', '---\ndescription: says hi\n---\nbody')
    expect(skill).toMatchObject({
      fileName: 'greeter.md',
      name: 'greeter', // no `name` in frontmatter → file name sans .md
      description: 'says hi',
      version: '1.0.0',
    })
  })

  it('prefers the frontmatter name when present', () => {
    const skill = toSkill('file.md', '---\nname: Pretty Name\n---\n')
    expect(skill.name).toBe('Pretty Name')
  })
})

describe('skills bridge', () => {
  beforeEach(() => vi.clearAllMocks())

  it('listSkillFiles invokes list_skills', async () => {
    mockInvoke.mockResolvedValue(['a.md', 'b.md'])
    expect(await listSkillFiles()).toEqual(['a.md', 'b.md'])
    expect(mockInvoke).toHaveBeenCalledWith('list_skills')
  })

  it('readSkillFile invokes read_skill with the file name', async () => {
    mockInvoke.mockResolvedValue('content')
    expect(await readSkillFile('x.md')).toBe('content')
    expect(mockInvoke).toHaveBeenCalledWith('read_skill', { name: 'x.md' })
  })

  it('writeSkillFile invokes write_skill with name and content', async () => {
    mockInvoke.mockResolvedValue(undefined)
    await writeSkillFile('x.md', '# hi')
    expect(mockInvoke).toHaveBeenCalledWith('write_skill', { name: 'x.md', content: '# hi' })
  })

  it('loadSkills lists then reads and parses each file', async () => {
    mockInvoke.mockImplementation(async (cmd: string, args?: { name: string }) => {
      if (cmd === 'list_skills') return ['one.md', 'two.md']
      if (cmd === 'read_skill') return `---\nname: ${args!.name}\ndescription: d\n---\nbody`
      throw new Error(`unexpected command ${cmd}`)
    })
    const skills = await loadSkills()
    expect(skills.map((s) => s.fileName)).toEqual(['one.md', 'two.md'])
    expect(skills[0].name).toBe('one.md')
    expect(skills[0].description).toBe('d')
  })
})
