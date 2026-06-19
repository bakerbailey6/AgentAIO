/**
 * Encrypted SQLite connection bootstrap (SQLCipher vault).
 *
 * The app DB is opened through the native `vault_*` commands
 * (`src-tauri/src/commands/vault.rs`) — a SQLCipher-keyed `rusqlite`
 * connection — NOT through `@tauri-apps/plugin-sql`. The plugin's sqlx layer
 * opens a bare URL with no hook to run `PRAGMA key` before the file is touched,
 * so it can neither create a SQLCipher file encrypted nor reopen one. Here we
 * key the DB (via a passphrase kept only in the OS keychain) **before** any
 * migration runs.
 *
 * The returned {@link Db} exposes the same `select`/`execute` surface the
 * repositories already use, so they are unchanged. The connection (and the
 * in-flight unlock promise) is cached as a module-level singleton.
 *
 * @module
 */
import { invoke } from '@tauri-apps/api/core'
import { getSecret, setSecret } from '@/lib/keychain'
import { ALL_MIGRATIONS } from './schema'

/** Keychain reference under which the vault passphrase is stored. */
export const VAULT_PASSPHRASE_REF = 'vault-passphrase'

/** Filename of the encrypted DB, resolved under the app config dir natively. */
const DB_FILENAME = 'acc.db'

/** Result of a non-query statement, mirroring the SQL plugin's shape. */
export interface ExecuteResult {
  rowsAffected: number
  lastInsertId: number
}

/**
 * Minimal DB handle the repositories depend on. Intentionally matches the
 * subset of `@tauri-apps/plugin-sql`'s `Database` that the repositories use, so
 * swapping the backend needs no repository changes.
 */
export interface Db {
  select<T>(query: string, bindValues?: unknown[]): Promise<T>
  execute(query: string, bindValues?: unknown[]): Promise<ExecuteResult>
}

let _dbPromise: Promise<Db> | null = null

/**
 * Generate a strong random passphrase (256 bits, base64url so it is safe to
 * embed in `PRAGMA key`).
 */
function generatePassphrase(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Return the vault passphrase from the keychain, generating and persisting one
 * on first run. The secret never touches the database.
 */
async function getOrCreatePassphrase(): Promise<string> {
  const existing = await getSecret(VAULT_PASSPHRASE_REF)
  if (existing) return existing
  const passphrase = generatePassphrase()
  await setSecret(VAULT_PASSPHRASE_REF, passphrase)
  return passphrase
}

/** Whether the vault has been initialized (a passphrase already exists). */
export async function vaultExists(): Promise<boolean> {
  return (await getSecret(VAULT_PASSPHRASE_REF)) !== null
}

/** Build the {@link Db} shim over the native `vault_select`/`vault_execute`. */
function makeDb(): Db {
  return {
    select: <T>(query: string, bindValues: unknown[] = []) =>
      invoke<T>('vault_select', { query, values: bindValues }),
    execute: (query: string, bindValues: unknown[] = []) =>
      invoke<ExecuteResult>('vault_execute', { query, values: bindValues }),
  }
}

/** Apply every `CREATE TABLE IF NOT EXISTS` migration in order. */
async function runMigrations(db: Db): Promise<void> {
  for (const sql of ALL_MIGRATIONS) {
    await db.execute(sql)
  }
}

/**
 * Unlock the encrypted vault and run migrations on first call; return the
 * cached connection thereafter. The in-flight promise is cached so concurrent
 * callers share one unlock/migration pass.
 */
export function initDb(): Promise<Db> {
  if (_dbPromise) return _dbPromise
  _dbPromise = (async () => {
    const passphrase = await getOrCreatePassphrase()
    // Key the DB BEFORE any migration. vault_open runs PRAGMA key first.
    await invoke('vault_open', { filename: DB_FILENAME, passphrase })
    const db = makeDb()
    await runMigrations(db)
    return db
  })()
  // If unlock fails, clear the cache so a later retry can try again.
  _dbPromise.catch(() => {
    _dbPromise = null
  })
  return _dbPromise
}
