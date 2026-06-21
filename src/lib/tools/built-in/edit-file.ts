/**
 * Built-in `edit_file` tool — replace an exact, unique snippet in a file
 * (Claude-Code's Edit). Safer than `file_write` for targeted changes: it fails
 * loudly if the old text is missing or ambiguous instead of clobbering the file.
 *
 * @module
 */
import type { JSONSchema, ToolContext, ToolDefinition } from '@/lib/interfaces'
import { assertPathAllowed } from './guards'
import { isTauri } from '@/lib/platform'
import { readTextFile, writeTextFile } from '@/lib/fs'

export interface EditFileInput {
  /** Absolute path of the file to edit. */
  path: string
  /** Exact text to replace. Must occur exactly once unless `replaceAll`. */
  oldText: string
  /** Replacement text. */
  newText: string
  /** Replace every occurrence instead of requiring a unique match. */
  replaceAll?: boolean
}

/** Replace an exact substring in a text file within the agent's allowed paths. */
export class EditFileTool implements ToolDefinition<EditFileInput, string> {
  readonly name = 'edit_file'
  readonly description =
    'Edit a file by replacing an exact text snippet. `oldText` must appear exactly once ' +
    '(unless `replaceAll` is true). Use this for targeted edits instead of rewriting the whole file.'
  readonly source = 'built-in' as const
  readonly version = '1.0.0'

  readonly inputSchema: JSONSchema<EditFileInput> = {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute path of the file to edit.' },
      oldText: { type: 'string', description: 'Exact text to replace (must be unique unless replaceAll).' },
      newText: { type: 'string', description: 'Replacement text.' },
      replaceAll: { type: 'boolean', description: 'Replace all occurrences (default false).' },
    },
    required: ['path', 'oldText', 'newText'],
  }

  async execute(input: EditFileInput, context: ToolContext): Promise<string> {
    assertPathAllowed(context.permissionScope, input.path)
    if (!isTauri()) {
      throw new Error('The edit_file tool requires the desktop app.')
    }
    const { allowedPaths } = context.permissionScope
    const original = await readTextFile(input.path, allowedPaths)
    const occurrences = original.split(input.oldText).length - 1
    if (occurrences === 0) {
      throw new Error(`edit_file: the oldText was not found in ${input.path}.`)
    }
    if (occurrences > 1 && !input.replaceAll) {
      throw new Error(
        `edit_file: the oldText appears ${occurrences} times in ${input.path}; ` +
          'make it unique or set replaceAll.',
      )
    }
    const updated = input.replaceAll
      ? original.split(input.oldText).join(input.newText)
      : original.replace(input.oldText, input.newText)
    await writeTextFile(input.path, updated, allowedPaths)
    return `Edited ${input.path} (${occurrences} replacement${occurrences === 1 ? '' : 's'}).`
  }
}
