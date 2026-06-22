/**
 * Built-in `grep` tool — search file contents in the workspace by regex,
 * Claude-Code style. Returns `path:line: text` hits.
 *
 * @module
 */
import type { JSONSchema, ToolContext, ToolDefinition } from '@/lib/interfaces'
import { assertPathAllowed } from './guards'
import { isTauri } from '@/lib/platform'
import { grepFiles } from '@/lib/fs'

export interface GrepInput {
  /** Regular expression to search for in file contents. */
  pattern: string
  /** Search root. Defaults to the agent's workspace root. */
  root?: string
}

/** Search the contents of files in the agent's workspace for a regex. */
export class GrepTool implements ToolDefinition<GrepInput, string> {
  readonly name = 'grep'
  readonly description =
    'Search file contents in the workspace for a regular expression. ' +
    'Returns matches as "path:line: text". Ignores .git, node_modules, target, dist, etc.'
  readonly source = 'built-in' as const
  readonly version = '1.0.0'

  readonly inputSchema: JSONSchema<GrepInput> = {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Regular expression to search for.' },
      root: { type: 'string', description: 'Absolute search root. Defaults to the workspace root.' },
    },
    required: ['pattern'],
  }

  async execute(input: GrepInput, context: ToolContext): Promise<string> {
    const root = input.root ?? context.permissionScope.allowedPaths[0]
    if (!root) throw new Error('No search root given and the agent has no workspace configured.')
    assertPathAllowed(context.permissionScope, root)
    if (!isTauri()) {
      throw new Error('The grep tool requires the desktop app.')
    }
    const hits = await grepFiles(root, input.pattern, context.permissionScope.allowedPaths)
    return hits.length
      ? hits.map((h) => `${h.path}:${h.line}: ${h.text}`).join('\n')
      : `(no matches for /${input.pattern}/)`
  }
}
