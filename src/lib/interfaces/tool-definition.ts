export interface JSONSchema<T = unknown> {
  type: string
  properties?: Record<string, JSONSchema>
  required?: string[]
  description?: string
  items?: JSONSchema
  [key: string]: unknown
}

export interface ToolContext {
  agentId: string
  sessionId: string
  permissionScope: import('./agent-provider').PermissionScope
}

export type ToolSource = 'built-in' | 'registry' | 'custom'

export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  readonly name: string
  readonly description: string
  readonly source: ToolSource
  readonly version: string
  inputSchema: JSONSchema<TInput>
  execute(input: TInput, context: ToolContext): Promise<TOutput>
}
