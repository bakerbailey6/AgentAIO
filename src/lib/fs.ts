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
