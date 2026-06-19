import { useState, useEffect } from 'react'
import { initDb, ToolRepository } from '@/lib/storage'
import type { ToolRow } from '@/lib/storage'
import type { ToolDefinition } from '@/lib/interfaces'

/**
 * Manage the user's installed tools for the store UI.
 *
 * Mirrors {@link useInstalledMcps}: loads installed tools from the `tools` table
 * on mount and exposes `install` / `uninstall` / `isInstalled` plus `installedId`
 * (the persisted row id, which is what gets written into an agent's `tool_ids`
 * when the tool is assigned). `install` persists a {@link ToolDefinition}'s
 * metadata + JSON Schema.
 */
export function useInstalledTools() {
  const [tools, setTools] = useState<ToolRow[]>([])

  useEffect(() => {
    let cancelled = false
    initDb()
      .then((db) => new ToolRepository(db).findAll())
      .then((rows) => {
        if (!cancelled) setTools(rows)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  async function install(tool: ToolDefinition): Promise<string> {
    const db = await initDb()
    const repo = new ToolRepository(db)
    const definition = { inputSchema: tool.inputSchema }
    const id = await repo.create({
      name: tool.name,
      description: tool.description,
      source: tool.source,
      version: tool.version,
      definition,
    })
    const newRow: ToolRow = {
      id,
      name: tool.name,
      description: tool.description,
      source: tool.source,
      version: tool.version,
      definition,
      createdAt: Date.now(),
    }
    setTools((prev) => [...prev, newRow])
    return id
  }

  async function uninstall(id: string): Promise<void> {
    const db = await initDb()
    await new ToolRepository(db).delete(id)
    setTools((prev) => prev.filter((t) => t.id !== id))
  }

  function isInstalled(name: string): boolean {
    return tools.some((t) => t.name === name)
  }

  /** The persisted row id for an installed tool name, or `undefined`. */
  function installedId(name: string): string | undefined {
    return tools.find((t) => t.name === name)?.id
  }

  return { tools, install, uninstall, isInstalled, installedId }
}
