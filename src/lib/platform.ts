/**
 * Runtime platform detection.
 *
 * Native capabilities — the OS keychain, the SQLite plugin, and child-process
 * CLIs (Claude Code, Codex, and the CLI-backed subscription providers) — are
 * implemented as Tauri commands and only exist in the desktop shell. Features
 * that depend on them should call {@link isTauri} and degrade gracefully in the
 * browser build instead of letting a Tauri `invoke` throw.
 *
 * @module
 */

/**
 * True when running inside the Tauri desktop shell.
 *
 * Tauri 2 injects `window.__TAURI_INTERNALS__` into the webview; its absence
 * means we are in a plain browser (`npm run dev`) where native commands are
 * unavailable.
 */
export function isTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== 'undefined'
  )
}
