/**
 * Registry of available {@link ToolDefinition}s, keyed by `name`. Mirrors
 * `PROVIDER_REGISTRY` / `AGENT_REGISTRY`: the Phase 2 tool-call loop will resolve
 * a tool by name here when an agent invokes it. To add a tool, implement
 * `ToolDefinition` and {@link registerTool} it — nothing else needs to change.
 *
 * Ships with the §8.2 built-in tier; registry-installed and custom tools are
 * persisted to the `tools` table and surfaced through the store.
 *
 * @module
 */
import type { ToolDefinition } from '@/lib/interfaces'
import { WebSearchTool } from './built-in/web-search'
import { FileReadTool } from './built-in/file-read'
import { FileWriteTool } from './built-in/file-write'
import { ListDirectoryTool } from './built-in/list-directory'
import { GlobTool } from './built-in/glob'
import { GrepTool } from './built-in/grep'
import { EditFileTool } from './built-in/edit-file'
import { ShellTool } from './built-in/shell'
import { BrowserTool } from './built-in/browser'
import { ImageGenerationTool } from './built-in/image-generation'

/** Built-in tools available out of the box (§8.2). */
export const TOOL_REGISTRY = new Map<string, ToolDefinition>([
  ['web_search', new WebSearchTool()],
  ['file_read', new FileReadTool()],
  ['file_write', new FileWriteTool()],
  ['list_directory', new ListDirectoryTool()],
  ['glob', new GlobTool()],
  ['grep', new GrepTool()],
  ['edit_file', new EditFileTool()],
  ['shell', new ShellTool()],
  ['browser', new BrowserTool()],
  ['image_generation', new ImageGenerationTool()],
])

/**
 * The built-in filesystem/repo toolset auto-granted to any agent that has a
 * workspace directory — what gives agents Claude-Code-style access to read,
 * navigate, search, and edit a repo. Consumed by `resolveCapabilities`.
 */
export const WORKSPACE_TOOL_NAMES = [
  'file_read',
  'file_write',
  'edit_file',
  'list_directory',
  'glob',
  'grep',
  'shell',
] as const

/** Register (or replace) a tool under its `name`. */
export function registerTool(tool: ToolDefinition): void {
  TOOL_REGISTRY.set(tool.name, tool)
}

/** The built-in tools as a list, for store/catalog display. */
export function listBuiltInTools(): ToolDefinition[] {
  return [...TOOL_REGISTRY.values()].filter((t) => t.source === 'built-in')
}
