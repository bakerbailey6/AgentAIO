/**
 * Shared permission-scope guards for the built-in tools.
 *
 * Every {@link ToolDefinition.execute} runs inside a {@link ToolContext} that
 * carries the agent's {@link PermissionScope} (§9.3 — zero-trust agents). These
 * helpers enforce that boundary *before* a tool would touch the OS or network.
 *
 * The execution backend itself (spawning processes, reading files, calling out
 * to a search API) is wired by the Phase 2 tool-call loop; until then a tool
 * that passes its permission check throws {@link notWiredYet} rather than
 * silently doing nothing. Implementing `execute` is in scope; *invoking* it from
 * an agent is not.
 *
 * @module
 */
import type { PermissionScope } from '@/lib/interfaces'

/** Thrown when a tool's effect is gated behind the Phase 2 execution loop. */
export function notWiredYet(toolName: string): Error {
  return new Error(
    `Tool "${toolName}" cannot run yet: the agent tool-call execution loop lands in Phase 2.`,
  )
}

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
