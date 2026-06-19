/**
 * SQLite connection bootstrap.
 *
 * Opens the local `acc.db` database via the Tauri SQL plugin and applies the
 * schema migrations once, the first time it's called. The connection is cached
 * as a module-level singleton, so every caller shares one connection.
 *
 * @module
 */
import Database from '@tauri-apps/plugin-sql'
import { ALL_MIGRATIONS } from './schema'

/** The resolved Tauri SQL database handle. */
export type Db = Awaited<ReturnType<typeof Database.load>>

let _db: Db | null = null

/**
 * Open the database (and run migrations) on first call; return the cached
 * connection thereafter.
 */
export async function initDb(): Promise<Db> {
  if (_db) return _db
  _db = await Database.load('sqlite:acc.db')
  await runMigrations(_db)
  return _db
}

/** Apply every `CREATE TABLE IF NOT EXISTS` migration in order. */
async function runMigrations(db: Db): Promise<void> {
  for (const sql of ALL_MIGRATIONS) {
    await db.execute(sql)
  }
}
