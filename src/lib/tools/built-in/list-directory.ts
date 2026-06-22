/**
 * Built-in `list_directory` tool — list the entries of a directory in the
 * agent's workspace (Claude-Code-style repo navigation).
 *
 * @module
 */
import type { JSONSchema, ToolContext, ToolDefinition } from '@/lib/interfaces'
import { assertPathAllowed } from './guards'
import { isTauri } from '@/lib/platform'
import { listDirectory } from '@/lib/fs'

export interface ListDirectoryInput {
  /** Directory to list. Defaults to the agent's workspace root. */
  path?: string
}

/** List the immediate files and subdirectories of a directory. */
export class ListDirectoryTool implements ToolDefinition<ListDirectoryInput, string> {
  readonly name = 'list_directory'
  readonly description =
    'List the files and subdirectories of a directory within the agent’s workspace. ' +
    'Omit `path` to list the workspace root.'
  readonly source = 'built-in' as const
  readonly version = '1.0.0'

  readonly inputSchema: JSONSchema<ListDirectoryInput> = {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute path of the directory to list. Defaults to the workspace root.' },
    },
    required: [],
  }

  async execute(input: ListDirectoryInput, context: ToolContext): Promise<string> {
    const root = input.path ?? context.permissionScope.allowedPaths[0]
    if (!root) throw new Error('No directory given and the agent has no workspace configured.')
    assertPathAllowed(context.permissionScope, root)
    if (!isTauri()) {
      throw new Error('The list_directory tool requires the desktop app.')
    }
    const entries = await listDirectory(root, context.permissionScope.allowedPaths)
    if (entries.length === 0) return `(empty directory: ${root})`
    return entries
      .map((e) => (e.is_dir ? `${e.name}/` : `${e.name} (${e.size} bytes)`))
      .join('\n')
  }
}
