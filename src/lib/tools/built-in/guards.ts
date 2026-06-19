/**
 * Shared permission-scope guards for the built-in tools.
 *
 * Every {@link ToolDefinition.execute} runs inside a {@link ToolContext} that
 * carries the agent's {@link PermissionScope} (§9.3 — zero-trust agents). These
 * helpers enforce that boundary *before* a tool touches the OS or network; the
 * built-in tools call their real backends (filesystem/process via the Tauri
 * sidecar, external APIs) only after the relevant guard passes.
 *
 * @module
 */
import type { PermissionScope } from '@/lib/interfaces'

/** Reject unless the agent's scope opts into shell access. */
export function assertShellAllowed(scope: PermissionScope): void {
  if (!scope.shellEnabled) {
    throw new Error('Shell access is denied by this agent’s permission scope.')
  }
}

/** Reject a path that is not under one of the scope's allowed roots. */
export function assertPathAllowed(scope: PermissionScope, path: string): void {
  const ok = scope.allowedPaths.some((root) => path === root || path.startsWith(root))
  if (!ok) {
    throw new Error(`Path "${path}" is outside this agent’s allowed paths.`)
  }
}

/** Reject a URL whose host is not in the scope's allowed-domain list. */
export function assertDomainAllowed(scope: PermissionScope, url: string): void {
  let host: string
  try {
    host = new URL(url).hostname
  } catch {
    throw new Error(`"${url}" is not a valid URL.`)
  }
  const ok = scope.allowedDomains.some((d) => host === d || host.endsWith(`.${d}`))
  if (!ok) {
    throw new Error(`Domain "${host}" is not in this agent’s allowed domains.`)
  }
}
