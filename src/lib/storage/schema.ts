/**
 * Database schema as a list of idempotent migrations.
 *
 * Each exported `CREATE_*` constant is a `CREATE TABLE IF NOT EXISTS` statement;
 * {@link ALL_MIGRATIONS} is the ordered list applied by `initDb` on startup.
 * Because every statement is `IF NOT EXISTS`, running them repeatedly is safe.
 *
 * Notes on intent:
 * - Ids default to random 16-byte hex, timestamps to `unixepoch()`.
 * - JSON-array columns (`tool_ids`, `mcp_ids`, `env_vars_ref`) are stored as
 *   text and parsed in the repositories.
 * - `models.api_key_ref` holds a *keychain reference*, never the key itself.
 * - `audit_log` is append-only by convention — there are no update/delete paths.
 *
 * @module
 */
export const CREATE_AGENTS = `
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('llm','coding-agent','custom')),
    model_id TEXT,
    system_prompt TEXT NOT NULL DEFAULT '',
    project_directory TEXT,
    tool_ids TEXT NOT NULL DEFAULT '[]',
    mcp_ids TEXT NOT NULL DEFAULT '[]',
    canvas_x REAL NOT NULL DEFAULT 0,
    canvas_y REAL NOT NULL DEFAULT 0,
    group_id TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
`

export const CREATE_SESSIONS = `
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    messages TEXT NOT NULL DEFAULT '[]',
    token_count INTEGER NOT NULL DEFAULT 0,
    cost_estimate REAL NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
`

export const CREATE_MODELS = `
  CREATE TABLE IF NOT EXISTS models (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    provider TEXT NOT NULL,
    model_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    api_key_ref TEXT,
    base_url TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
`

export const CREATE_MCPS = `
  CREATE TABLE IF NOT EXISTS mcps (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    transport TEXT NOT NULL CHECK(transport IN ('stdio','sse')),
    command_or_url TEXT NOT NULL,
    env_vars_ref TEXT NOT NULL DEFAULT '[]',
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
`

export const CREATE_TOOLS = `
  CREATE TABLE IF NOT EXISTS tools (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    source TEXT NOT NULL CHECK(source IN ('built-in','registry','custom')),
    version TEXT NOT NULL DEFAULT '1.0.0',
    definition TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
`

export const CREATE_AUDIT_LOG = `
  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    action_type TEXT NOT NULL,
    payload TEXT NOT NULL DEFAULT '{}',
    approved_by TEXT,
    timestamp INTEGER NOT NULL DEFAULT (unixepoch())
  )
`

export const CREATE_CANVAS_STATE = `
  CREATE TABLE IF NOT EXISTS canvas_state (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    viewport_x REAL NOT NULL DEFAULT 0,
    viewport_y REAL NOT NULL DEFAULT 0,
    zoom REAL NOT NULL DEFAULT 1,
    group_definitions TEXT NOT NULL DEFAULT '[]'
  )
`

export const CREATE_WORKFLOWS = `
  CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    nodes TEXT NOT NULL DEFAULT '[]',
    edges TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
`

export const CREATE_WORKFLOW_RUNS = `
  CREATE TABLE IF NOT EXISTS workflow_runs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running','done','error')),
    input TEXT NOT NULL DEFAULT 'null',
    result TEXT NOT NULL DEFAULT 'null',
    node_states TEXT NOT NULL DEFAULT '{}',
    started_at INTEGER NOT NULL DEFAULT (unixepoch()),
    finished_at INTEGER
  )
`

/** Every migration, in the order they must be applied. */
export const ALL_MIGRATIONS = [
  CREATE_AGENTS,
  CREATE_SESSIONS,
  CREATE_MODELS,
  CREATE_MCPS,
  CREATE_TOOLS,
  CREATE_AUDIT_LOG,
  CREATE_CANVAS_STATE,
  CREATE_WORKFLOWS,
  CREATE_WORKFLOW_RUNS,
]
