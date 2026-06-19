/**
 * Front-end access to skills, via the Rust sidecar.
 *
 * Skills are Markdown files with YAML frontmatter, stored in `~/.acc/skills`
 * (§8.3). The native commands (`src-tauri/src/commands/skills.rs`) handle the
 * filesystem — and the path-traversal guarding — so these wrappers only marshal
 * arguments and parse the frontmatter into a typed {@link Skill}. Like the
 * keychain bridge, these only work in the desktop build (`invoke` rejects in the
 * browser).
 *
 * @module
 */
import { invoke } from '@tauri-apps/api/core'

/** A skill loaded from `~/.acc/skills`, with its frontmatter parsed out. */
export interface Skill {
  /** The `.md` file name — the stable id used for assignment. */
  fileName: string
  /** Display name: frontmatter `name`, falling back to the file name. */
  name: string
  /** One-line summary from frontmatter `description` (empty if absent). */
  description: string
  /** Version from frontmatter `version` (defaults to `1.0.0`). */
  version: string
  /** All parsed frontmatter key/value pairs. */
  frontmatter: Record<string, string>
  /** The Markdown body after the frontmatter block. */
  body: string
}

/** Result of {@link parseFrontmatter}. */
export interface ParsedFrontmatter {
  frontmatter: Record<string, string>
  body: string
}

function unquote(value: string): string {
  const t = value.trim()
  if (
    t.length >= 2 &&
    ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))
  ) {
    return t.slice(1, -1)
  }
  return t
}

/**
 * Parse a leading `---`-fenced YAML frontmatter block.
 *
 * Deliberately tiny: it handles flat `key: value` scalar pairs, which is all
 * skill metadata needs. A file with no opening `---` (or no closing fence) is
 * treated as all body, with empty frontmatter.
 */
export function parseFrontmatter(raw: string): ParsedFrontmatter {
  const lines = raw.split(/\r?\n/)
  if (lines[0]?.trim() !== '---') {
    return { frontmatter: {}, body: raw }
  }
  // Find the closing fence.
  let end = -1
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      end = i
      break
    }
  }
  if (end === -1) {
    // Opening fence with no close — not valid frontmatter; keep it all as body.
    return { frontmatter: {}, body: raw }
  }

  const frontmatter: Record<string, string> = {}
  for (let i = 1; i < end; i++) {
    const line = lines[i]
    if (!line.trim() || line.trimStart().startsWith('#')) continue
    const match = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/)
    if (match) {
      frontmatter[match[1]] = unquote(match[2])
    }
  }

  return { frontmatter, body: lines.slice(end + 1).join('\n') }
}

/** Build a {@link Skill} from a file name and its raw Markdown. */
export function toSkill(fileName: string, raw: string): Skill {
  const { frontmatter, body } = parseFrontmatter(raw)
  return {
    fileName,
    name: frontmatter.name || fileName.replace(/\.md$/, ''),
    description: frontmatter.description ?? '',
    version: frontmatter.version ?? '1.0.0',
    frontmatter,
    body,
  }
}

/** List the `.md` skill file names in `~/.acc/skills`. */
export async function listSkillFiles(): Promise<string[]> {
  return invoke<string[]>('list_skills')
}

/** Read the raw Markdown of one skill file. */
export async function readSkillFile(fileName: string): Promise<string> {
  return invoke<string>('read_skill', { name: fileName })
}

/** Write (create or overwrite) one skill file. */
export async function writeSkillFile(fileName: string, content: string): Promise<void> {
  await invoke<void>('write_skill', { name: fileName, content })
}

/** Load and parse every skill in `~/.acc/skills`. */
export async function loadSkills(): Promise<Skill[]> {
  const files = await listSkillFiles()
  return Promise.all(files.map(async (f) => toSkill(f, await readSkillFile(f))))
}
