import { useState, useEffect, useCallback } from 'react'
import { initDb, AgentRepository } from '@/lib/storage'
import type { AgentRow } from '@/lib/storage'

/**
 * Per-agent assignment of tools and skills for the store UI.
 *
 * Assignment is stored in the existing `agents.tool_ids` column (§8.4): an
 * installed tool is referenced by its `tools` row id, a skill by a `skill:<file>`
 * id. `toggle` adds/removes an id on one agent and persists via
 * {@link AgentRepository.updateToolIds}; the `assignedAgent*` helpers report
 * which agents currently carry a given item id.
 */
export function useAgentAssignments() {
  const [agents, setAgents] = useState<AgentRow[]>([])

  useEffect(() => {
    let cancelled = false
    initDb()
      .then((db) => new AgentRepository(db).findAll())
      .then((rows) => {
        if (!cancelled) setAgents(rows)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const toggle = useCallback(
    async (itemId: string, agentId: string, assigned: boolean) => {
      const agent = agents.find((a) => a.id === agentId)
      if (!agent) return
      const next = new Set(agent.toolIds)
      if (assigned) next.add(itemId)
      else next.delete(itemId)
      const toolIds = [...next]
      const db = await initDb()
      await new AgentRepository(db).updateToolIds(agentId, toolIds)
      setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, toolIds } : a)))
    },
    [agents],
  )

  const assignedAgentIds = useCallback(
    (itemId: string) => agents.filter((a) => a.toolIds.includes(itemId)).map((a) => a.id),
    [agents],
  )

  const assignedAgentNames = useCallback(
    (itemId: string) => agents.filter((a) => a.toolIds.includes(itemId)).map((a) => a.name),
    [agents],
  )

  return { agents, toggle, assignedAgentIds, assignedAgentNames }
}
