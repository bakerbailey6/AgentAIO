/**
 * Built-in file-write tool (§8.2).
 *
 * @module
 */
import type { JSONSchema, ToolContext, ToolDefinition } from '@/lib/interfaces'
import { assertPathAllowed } from './guards'
import { isTauri } from '@/lib/platform'
import { writeTextFile } from '@/lib/fs'

/** Arguments accepted by {@link FileWriteTool}. */
export interface FileWriteInput {
  /** Absolute path of the file to write. */
  path: string
  /** UTF-8 contents to write (overwrites any existing file). */
  contents: string
}

/** Write a UTF-8 text file to an allowed path. */
export class FileWriteTool implements ToolDefinition<FileWriteInput, void> {
  readonly name = 'file_write'
  readonly description = 'Write text to a file within the agent’s allowed paths (overwrites existing).'
  readonly source = 'built-in' as const
  readonly version = '1.0.0'

  readonly inputSchema: JSONSchema<FileWriteInput> = {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute path of the file to write.' },
      contents: { type: 'string', description: 'UTF-8 contents to write.' },
    },
    required: ['path', 'contents'],
  }

  async execute(input: FileWriteInput, context: ToolContext): Promise<void> {
    assertPathAllowed(context.permissionScope, input.path)
    if (!isTauri()) {
      throw new Error('The file_write tool requires the desktop app (no filesystem access in web mode).')
    }
    await writeTextFile(input.path, input.contents, context.permissionScope.allowedPaths)
  }
}
