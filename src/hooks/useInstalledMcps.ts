import { useState, useEffect } from 'react'
import { initDb, McpRepository } from '@/lib/storage'
import type { McpRow } from '@/lib/storage'
import type { CatalogMcpEntry } from '@/lib/store/catalog'

export function useInstalledMcps() {
  const [mcps, setMcps] = useState<McpRow[]>([])

  useEffect(() => {
    initDb().then(db => {
      const repo = new McpRepository(db)
      repo.findAll().then(setMcps)
    })
  }, [])

  async function install(entry: CatalogMcpEntry): Promise<void> {
    const db = await initDb()
    const repo = new McpRepository(db)
    const id = await repo.create({
      name: entry.name,
      transport: entry.transport,
      commandOrUrl: entry.commandTemplate,
      envVarsRef: [],
      enabled: true,
    })
    const newRow: McpRow = {
      id,
      name: entry.name,
      transport: entry.transport,
      commandOrUrl: entry.commandTemplate,
      envVarsRef: [],
      enabled: true,
      createdAt: Date.now(),
    }
    setMcps(prev => [...prev, newRow])
  }

  async function uninstall(id: string): Promise<void> {
    const db = await initDb()
    const repo = new McpRepository(db)
    await repo.delete(id)
    setMcps(prev => prev.filter(m => m.id !== id))
  }

  function isInstalled(name: string): boolean {
    return mcps.some(m => m.name === name)
  }

  return { mcps, install, uninstall, isInstalled }
}
