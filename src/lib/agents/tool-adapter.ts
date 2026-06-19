/**
 * Adapts repo {@link ToolDefinition}s into Vercel AI SDK tools.
 *
 * The agent tool-call loop hands the LLM a set of AI SDK tools; this module is
 * the bridge from our internal {@link ToolDefinition} contract to that shape.
 * Conversion wires the tool's JSON Schema through `jsonSchema()` and wraps
 * execution in an approval gate so dangerous capabilities (shell, file writes)
 * require explicit user sign-off before they run.
 *
 * A Phase-5 stub ({@link toAiMcpTool}) wraps MCP tools — whose input/output
 * shapes are unknown at build time — via `dynamicTool`.
 *
 * @module
 */
import { tool, jsonSchema, dynamicTool } from 'ai'
import type { Tool } from 'ai'
import type { ToolDefinition, PermissionScope } from '@/lib/interfaces'
import { requestApproval } from './approval-gate'

/** Per-run context threaded into every converted tool's `execute`. */
export interface ToolAdapterContext {
  agentId: string
  sessionId: string
  permissionScope: PermissionScope
}

/**
 * Tools that may touch the host system and therefore require explicit user
 * approval before each invocation, regardless of the agent's permission scope.
 */
const DANGEROUS_TOOLS = new Set(['shell', 'file_write'])

/** Whether a tool must be gated behind an approval prompt before it runs. */
export function needsApproval(toolName: string, _scope: PermissionScope): boolean {
  return DANGEROUS_TOOLS.has(toolName)
}

/**
 * Convert a {@link ToolDefinition} into an AI SDK {@link Tool} the LLM can call.
 *
 * The wrapped `execute` enforces the approval gate for dangerous tools: it asks
 * the user first and, if denied, returns a short string so the model can keep
 * going rather than throwing. Errors thrown by the underlying tool are *not*
 * caught — they propagate so the SDK emits a tool-error part.
 */
export function toAiTool(def: ToolDefinition, ctx: ToolAdapterContext): Tool {
  return tool({
    description: def.description,
    inputSchema: jsonSchema(def.inputSchema as Parameters<typeof jsonSchema>[0]),
    execute: async (input: unknown) => {
      if (needsApproval(def.name, ctx.permissionScope)) {
        const approved = await requestApproval({
          agentId: ctx.agentId,
          sessionId: ctx.sessionId,
          action: def.name,
          description: `Run ${def.name}`,
          risk: def.name === 'shell' ? 'high' : 'medium',
        })
        if (!approved) {
          return `Denied by user: ${def.name} was not run.`
        }
      }
      return def.execute(input, {
        agentId: ctx.agentId,
        sessionId: ctx.sessionId,
        permissionScope: ctx.permissionScope,
      })
    },
  })
}

/**
 * Phase-5 stub: wrap an MCP tool of unknown input/output shape as a dynamic AI
 * SDK tool. The schema is intentionally permissive; the MCP server owns
 * validation.
 */
export function toAiMcpTool(
  serverId: string,
  toolName: string,
  description: string,
  call: (input: unknown) => Promise<unknown>,
): Tool {
  return dynamicTool({
    description,
    inputSchema: jsonSchema({ type: 'object' } as Parameters<typeof jsonSchema>[0]),
    execute: async (input: unknown) => call(input),
  })
}

/** Stable key for an MCP tool, namespaced by its server. */
export function mcpToolKey(serverId: string, toolName: string): string {
  return `mcp__${serverId}__${toolName}`
}
