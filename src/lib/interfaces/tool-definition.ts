/**
 * The tool contract.
 *
 * A {@link ToolDefinition} is a single capability an agent can invoke — built-in
 * (web search, file IO, shell), installed from a registry, or user-defined. Each
 * declares a JSON Schema for its input so the LLM can call it, and executes
 * within a {@link ToolContext} that carries the agent's permission scope.
 *
 * @module
 */

/**
 * A minimal JSON Schema description of a value.
 *
 * @typeParam T - The TypeScript type this schema describes (phantom; for inference only).
 */
export interface JSONSchema<T = unknown> {
  type: string
  properties?: Record<string, JSONSchema>
  required?: string[]
  description?: string
  items?: JSONSchema
  [key: string]: unknown
}

/** Runtime context handed to a tool, including the caller's sandbox. */
export interface ToolContext {
  agentId: string
  sessionId: string
  permissionScope: import('./agent-provider').PermissionScope
}

/** Where a tool came from, used by the store UI for grouping and trust. */
export type ToolSource = 'built-in' | 'registry' | 'custom'

/**
 * A callable capability exposed to agents.
 *
 * @typeParam TInput  - Argument shape, described by {@link inputSchema}.
 * @typeParam TOutput - Result returned by {@link execute}.
 */
export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  readonly name: string
  readonly description: string
  readonly source: ToolSource
  readonly version: string
  /** JSON Schema the LLM uses to construct valid `TInput`. */
  inputSchema: JSONSchema<TInput>
  /** Run the tool, enforcing `context.permissionScope`. */
  execute(input: TInput, context: ToolContext): Promise<TOutput>
}
