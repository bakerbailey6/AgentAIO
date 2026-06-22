/**
 * Front-end access to the filesystem, via the Rust sidecar.
 *
 * Backs the built-in `file_read` / `file_write` tools. The native commands
 * (`src-tauri/src/commands/fs.rs`) do the IO and re-check the path against the
 * agent's allowed roots (defense in depth — the caller also checks via
 * `assertPathAllowed`). Like the keychain bridge, these only work in the desktop
 * build (`invoke` rejects in the browser).
 *
 * @module
 */
import { invoke } from '@tauri-apps/api/core'

/**
 * Read a UTF-8 text file.
 *
 * @param path - Absolute path of the file to read.
 * @param allowedPaths - The agent's allowed roots; the native side rejects a
 *   `path` outside all of them.
 */
export async function readTextFile(path: string, allowedPaths: string[]): Promise<string> {
  return invoke<string>('fs_read_text', { path, allowedPaths })
}

/**
 * Write (create or overwrite) a UTF-8 text file, creating parent dirs.
 *
 * @param path - Absolute path of the file to write.
 * @param content - UTF-8 contents.
 * @param allowedPaths - The agent's allowed roots; the native side rejects a
 *   `path` outside all of them.
 */
export async function writeTextFile(
  path: string,
  content: string,
  allowedPaths: string[],
): Promise<void> {
  await invoke<void>('fs_write_text', { path, content, allowedPaths })
}

/** One entry in a directory listing (from `fs_list_directory`). */
export interface DirEntry {
  name: string
  path: string
  is_dir: boolean
  size: number
}

/** One content-search hit (from `fs_grep`). */
export interface GrepMatch {
  path: string
  line: number
  text: string
}

/** List the immediate entries of a directory within the agent's allowed roots. */
export async function listDirectory(path: string, allowedPaths: string[]): Promise<DirEntry[]> {
  return invoke<DirEntry[]>('fs_list_directory', { path, allowedPaths })
}

/** Find files under `root` whose root-relative path matches a glob `pattern`. */
export async function globFiles(root: string, pattern: string, allowedPaths: string[]): Promise<string[]> {
  return invoke<string[]>('fs_glob', { root, pattern, allowedPaths })
}

/** Search file contents under `root` for a regex `pattern`. */
export async function grepFiles(root: string, pattern: string, allowedPaths: string[]): Promise<GrepMatch[]> {
  return invoke<GrepMatch[]>('fs_grep', { root, pattern, allowedPaths })
}
