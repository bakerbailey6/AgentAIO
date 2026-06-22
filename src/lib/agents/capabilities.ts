/**
 * Resolve an agent's stored assignment ids into the concrete capabilities the
 * runtime tool-call loop needs:
 *
 * - **tools** — executable {@link ToolDefinition}s, looked up by the installed
 *   `tools` row's `name` in {@link TOOL_REGISTRY}.
 * - **skillBodies** — the Markdown bodies of assigned skills, to inject into the
 *   system prompt.
 * - **mcpServerIds** — installed `mcps` row ids, passed straight through for the
 *   Phase 5 MCP runtime.
 *
 * `agent.toolIds` mixes two kinds of id: a skill id is `` `skill:${fileName}` ``
 * (e.g. `skill:foo.md`); every other entry is an installed `tools` row UUID.
 * `agent.mcpIds` holds installed `mcps` row UUIDs.
 *
 * Resolution is **lenient**: any id that fails to resolve (a deleted tool row, a
 * tool with no registered implementation, a skill file that won't load) becomes
 * a human-readable `warning` rather than throwing, so a stale assignment never
 * breaks an otherwise-runnable agent.
 *
 * @module
 */
import type { AgentRow } from '@/lib/storage'
import type { ToolDefinition } from '@/lib/interfaces'
import { initDb, ToolRepository } from '@/lib/storage'
import { TOOL_REGISTRY, WORKSPACE_TOOL_NAMES } from '@/lib/tools/registry'
import { readSkillFile, toSkill } from '@/lib/skills'

/** Prefix marking a {@link AgentRow.toolIds} entry as a skill rather than a tool. */
const SKILL_PREFIX = 'skill:'

/** The runtime capabilities resolved from an agent's stored assignment ids. */
export interface ResolvedCapabilities {
  /** Executable tool definitions, keyed by tool name. */
  tools: Map<string, ToolDefinition>
  /** Skill Markdown bodies, in `agent.toolIds` order, for system-prompt injection. */
  skillBodies: string[]
  /** Installed MCP server ids — a passthrough of `agent.mcpIds` (used in Phase 5). */
  mcpServerIds: string[]
  /** Human-readable notes for assignments that could not be resolved. */
  warnings: string[]
}

/**
 * Resolve {@link AgentRow.toolIds} / {@link AgentRow.mcpIds} into the concrete
 * {@link ResolvedCapabilities} the runtime needs. Never throws for a missing or
 * unresolvable assignment — those are reported in `warnings`.
 */
export async function resolveCapabilities(agent: AgentRow): Promise<ResolvedCapabilities> {
  const tools = new Map<string, ToolDefinition>()
  const skillBodies: string[] = []
  const warnings: string[] = []

  // Partition the mixed toolIds into skill ids and installed-tool row ids.
  const skillIds: string[] = []
  const toolRowIds: string[] = []
  for (const id of agent.toolIds) {
    if (id.startsWith(SKILL_PREFIX)) {
      skillIds.push(id)
    } else {
      toolRowIds.push(id)
    }
  }

  // Resolve installed tool rows to registered implementations. Only touch the
  // DB when there's at least one tool-row id to look up.
  if (toolRowIds.length > 0) {
    const db = await initDb()
    const repo = new ToolRepository(db)
    for (const id of toolRowIds) {
      const row = await repo.findById(id)
      if (!row) {
        warnings.push(`Tool ${id} not found`)
        continue
      }
      const def = TOOL_REGISTRY.get(row.name)
      if (!def) {
        warnings.push(`Tool "${row.name}" has no registered implementation`)
        continue
      }
      tools.set(def.name, def)
    }
  }

  // Auto-grant the filesystem/repo toolset to any agent that has a workspace
  // directory. This is what gives agents Claude-Code-style access to read,
  // navigate, search, and edit the repo without manually assigning each tool.
  if (agent.projectDirectory) {
    for (const name of WORKSPACE_TOOL_NAMES) {
      const def = TOOL_REGISTRY.get(name)
      if (def) tools.set(def.name, def)
    }
  }

  // Resolve skills to their Markdown bodies, in toolIds order.
  for (const id of skillIds) {
    const fileName = id.slice(SKILL_PREFIX.length)
    try {
      skillBodies.push(toSkill(fileName, await readSkillFile(fileName)).body)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      warnings.push(`Skill ${fileName} failed to load: ${msg}`)
    }
  }

  return {
    tools,
    skillBodies,
    mcpServerIds: agent.mcpIds,
    warnings,
  }
}
