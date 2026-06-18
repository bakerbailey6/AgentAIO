// src/lib/storage/db.ts
import Database from '@tauri-apps/plugin-sql'
import { ALL_MIGRATIONS } from './schema'

export type Db = Awaited<ReturnType<typeof Database.load>>

let _db: Db | null = null

export async function initDb(): Promise<Db> {
  if (_db) return _db
  _db = await Database.load('sqlite:acc.db')
  await runMigrations(_db)
  return _db
}

async function runMigrations(db: Db): Promise<void> {
  for (const sql of ALL_MIGRATIONS) {
    await db.execute(sql)
  }
}
