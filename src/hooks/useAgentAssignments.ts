import { useState, useEffect, useCallback } from 'react'
import { initDb, AgentRepository } from '@/lib/storage'
import type { AgentRow } from '@/lib/storage'

/** Which assignment column a store item maps to. */
export type AssignKind = 'tool' | 'mcp'

/**
 * Per-agent assignment of tools, skills, and MCP servers for the store UI.
 *
 * Assignment is stored in the existing `agents.tool_ids` / `agents.mcp_ids`
 * columns (§8.4): an installed tool is referenced by its `tools` row id, a skill
 * by a `skill:<file>` id, an MCP server by its `mcps` row id. `toggle`
 * adds/removes an id on one agent and persists via the matching repository
 * method ({@link AgentRepository.updateToolIds} / `updateMcpIds`); the
 * `assignedAgent*` helpers report which agents currently carry a given item id.
 * The `kind` argument selects the column and defaults to `'tool'`.
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
    async (itemId: string, agentId: string, assigned: boolean, kind: AssignKind = 'tool') => {
      const agent = agents.find((a) => a.id === agentId)
      if (!agent) return
      const next = new Set(kind === 'mcp' ? agent.mcpIds : agent.toolIds)
      if (assigned) next.add(itemId)
      else next.delete(itemId)
      const ids = [...next]
      const db = await initDb()
      const repo = new AgentRepository(db)
      if (kind === 'mcp') {
        await repo.updateMcpIds(agentId, ids)
        setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, mcpIds: ids } : a)))
      } else {
        await repo.updateToolIds(agentId, ids)
        setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, toolIds: ids } : a)))
      }
    },
    [agents],
  )

  const assignedAgentIds = useCallback(
    (itemId: string, kind: AssignKind = 'tool') =>
      agents
        .filter((a) => (kind === 'mcp' ? a.mcpIds : a.toolIds).includes(itemId))
        .map((a) => a.id),
    [agents],
  )

  const assignedAgentNames = useCallback(
    (itemId: string, kind: AssignKind = 'tool') =>
      agents
        .filter((a) => (kind === 'mcp' ? a.mcpIds : a.toolIds).includes(itemId))
        .map((a) => a.name),
    [agents],
  )

  return { agents, toggle, assignedAgentIds, assignedAgentNames }
}
