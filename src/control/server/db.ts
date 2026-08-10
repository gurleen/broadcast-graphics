import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { runMigrations } from './migrations'

type GlobalDb = typeof globalThis & {
  __controllerDb?: Database
}

function resolveDbPath(): string {
  return process.env.CONTROLLER_DB ?? 'data/controller.db'
}

export function getDb(): Database {
  const g = globalThis as GlobalDb
  if (g.__controllerDb) return g.__controllerDb

  const path = resolveDbPath()
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true })
  }

  const db = new Database(path, { create: true })
  db.exec('pragma journal_mode = WAL;')
  db.exec('pragma foreign_keys = ON;')
  runMigrations(db)

  g.__controllerDb = db
  return db
}

/** Reset the cached handle (tests only). */
export function resetDbCache(): void {
  const g = globalThis as GlobalDb
  if (g.__controllerDb) {
    try {
      g.__controllerDb.close()
    } catch {
      // ignore
    }
    g.__controllerDb = undefined
  }
}
