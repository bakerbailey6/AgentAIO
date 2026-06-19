import { useState, useEffect, useCallback } from 'react'
import { loadSkills, writeSkillFile } from '@/lib/skills'
import type { Skill } from '@/lib/skills'

/**
 * Load the skills in `~/.acc/skills` for the store UI.
 *
 * Skills are "installed" simply by existing as files (dropped in by the user or
 * written via `create`), so the loaded list *is* the installed set. `create`
 * writes a starter Markdown file and refreshes. Errors (e.g. running in the
 * browser, where the native command rejects) leave the list empty rather than
 * throwing — mirroring how the rest of the app tolerates the web build.
 */
export function useSkills() {
  const [skills, setSkills] = useState<Skill[]>([])

  const refresh = useCallback(async () => {
    try {
      setSkills(await loadSkills())
    } catch {
      // No native backend (web mode) — leave the list as-is.
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    loadSkills()
      .then((s) => {
        if (!cancelled) setSkills(s)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  /** Write a skill file (a `.md` name) then reload the list. */
  async function create(fileName: string, content: string): Promise<void> {
    await writeSkillFile(fileName, content)
    await refresh()
  }

  return { skills, create, refresh }
}
