/**
 * Front-end access to the OS keychain, via the Rust sidecar.
 *
 * Secrets (API keys, tokens) are stored exclusively in the OS keychain — Windows
 * Credential Manager, macOS Keychain, or libsecret — and never written to the
 * SQLite database; the database only holds a *reference* (the `key`) to the
 * entry. Each function forwards to the corresponding Tauri command in
 * `src-tauri/src/commands/keychain.rs`, so these only work in the desktop build.
 *
 * @module
 */
import { invoke } from '@tauri-apps/api/core'

/** Store (or overwrite) a secret under `key`. */
export async function setSecret(key: string, value: string): Promise<void> {
  await invoke<void>('set_secret', { key, value })
}

/** Read a secret, or `null` if no entry exists for `key`. */
export async function getSecret(key: string): Promise<string | null> {
  return invoke<string | null>('get_secret', { key })
}

/** Remove a secret. A no-op if `key` does not exist. */
export async function deleteSecret(key: string): Promise<void> {
  await invoke<void>('delete_secret', { key })
}
