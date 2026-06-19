/**
 * Built-in shell tool (§8.2).
 *
 * Shell is disabled by default (§9.4) — `execute` refuses unless the agent's
 * permission scope opts in via `shellEnabled`.
 *
 * @module
 */
import type { JSONSchema, ToolContext, ToolDefinition } from '@/lib/interfaces'
import { assertShellAllowed, notWiredYet } from './guards'

/** Arguments accepted by {@link ShellTool}. */
export interface ShellInput {
  /** Executable to run. */
  command: string
  /** Arguments passed to the executable. */
  args?: string[]
  /** Working directory for the command. */
  cwd?: string
}

/** Result of a completed shell command. */
export interface ShellResult {
  stdout: string
  stderr: string
  exitCode: number
}

/** Run a shell command (opt-in per agent). */
export class ShellTool implements ToolDefinition<ShellInput, ShellResult> {
  readonly name = 'shell'
  readonly description = 'Run a shell command. Disabled unless the agent’s scope enables shell access.'
  readonly source = 'built-in' as const
  readonly version = '1.0.0'

  readonly inputSchema: JSONSchema<ShellInput> = {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Executable to run.' },
      args: { type: 'array', items: { type: 'string' }, description: 'Arguments for the executable.' },
      cwd: { type: 'string', description: 'Working directory.' },
    },
    required: ['command'],
  }

  async execute(input: ShellInput, context: ToolContext): Promise<ShellResult> {
    assertShellAllowed(context.permissionScope)
    void input
    throw notWiredYet(this.name)
  }
}
