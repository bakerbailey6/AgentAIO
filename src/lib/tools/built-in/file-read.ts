/**
 * Built-in file-read tool (§8.2).
 *
 * @module
 */
import type { JSONSchema, ToolContext, ToolDefinition } from '@/lib/interfaces'
import { assertPathAllowed, notWiredYet } from './guards'

/** Arguments accepted by {@link FileReadTool}. */
export interface FileReadInput {
  /** Absolute path of the file to read. */
  path: string
}

/** Read a UTF-8 text file from an allowed path. */
export class FileReadTool implements ToolDefinition<FileReadInput, string> {
  readonly name = 'file_read'
  readonly description = 'Read the contents of a text file within the agent’s allowed paths.'
  readonly source = 'built-in' as const
  readonly version = '1.0.0'

  readonly inputSchema: JSONSchema<FileReadInput> = {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute path of the file to read.' },
    },
    required: ['path'],
  }

  async execute(input: FileReadInput, context: ToolContext): Promise<string> {
    assertPathAllowed(context.permissionScope, input.path)
    throw notWiredYet(this.name)
  }
}
