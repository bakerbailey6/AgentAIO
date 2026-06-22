/**
 * Built-in `glob` tool — find files in the workspace by glob pattern
 * (`**`, `*`, `?`), Claude-Code style. Skips `.git`/`node_modules`/etc.
 *
 * @module
 */
import type { JSONSchema, ToolContext, ToolDefinition } from '@/lib/interfaces'
import { assertPathAllowed } from './guards'
import { isTauri } from '@/lib/platform'
import { globFiles } from '@/lib/fs'

export interface GlobInput {
  /** Glob pattern matched against paths relative to the search root, e.g. `**​/*.ts`. */
  pattern: string
  /** Search root. Defaults to the agent's workspace root. */
  root?: string
}

/** Find files matching a glob pattern within the agent's workspace. */
export class GlobTool implements ToolDefinition<GlobInput, string> {
  readonly name = 'glob'
  readonly description =
    'Find files in the workspace matching a glob pattern (e.g. "**/*.ts", "src/*.rs"). ' +
    'Returns matching absolute paths. Ignores .git, node_modules, target, dist, etc.'
  readonly source = 'built-in' as const
  readonly version = '1.0.0'

  readonly inputSchema: JSONSchema<GlobInput> = {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Glob pattern, e.g. "**/*.ts".' },
      root: { type: 'string', description: 'Absolute search root. Defaults to the workspace root.' },
    },
    required: ['pattern'],
  }

  async execute(input: GlobInput, context: ToolContext): Promise<string> {
    const root = input.root ?? context.permissionScope.allowedPaths[0]
    if (!root) throw new Error('No search root given and the agent has no workspace configured.')
    assertPathAllowed(context.permissionScope, root)
    if (!isTauri()) {
      throw new Error('The glob tool requires the desktop app.')
    }
    const hits = await globFiles(root, input.pattern, context.permissionScope.allowedPaths)
    return hits.length ? hits.join('\n') : `(no files match "${input.pattern}")`
  }
}
