/**
 * Public surface of the storage layer.
 *
 * Re-exports {@link initDb} and one repository per table. Each repository wraps
 * the SQL for its table and (de)serializes JSON columns, so callers work with
 * typed `*Row` objects instead of raw SQL.
 *
 * @module
 */
export { initDb } from './db'
export type { Db } from './db'
export { AgentRepository } from './repositories/agents'
export type { AgentRow } from './repositories/agents'
export { SessionRepository } from './repositories/sessions'
export type { SessionRow } from './repositories/sessions'
export { ModelRepository } from './repositories/models'
export type { ModelRow } from './repositories/models'
export { McpRepository } from './repositories/mcps'
export type { McpRow } from './repositories/mcps'
export { ToolRepository } from './repositories/tools'
export type { ToolRow } from './repositories/tools'
export { AuditLogRepository } from './repositories/audit-log'
export type { AuditLogEntry } from './repositories/audit-log'
export { WorkflowRepository } from './repositories/workflows'
export type { WorkflowRow } from './repositories/workflows'
export { WorkflowRunRepository } from './repositories/workflow-runs'
export type { WorkflowRunRow } from './repositories/workflow-runs'
