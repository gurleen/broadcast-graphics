import type { Database } from 'bun:sqlite'
import type { GraphicInstance, Rundown } from '../model'
import { getDb } from './db'

type RundownRow = {
  id: string
  name: string
  created_at: number
  updated_at: number
  cued_instance_id: string | null
}

type InstanceRow = {
  id: string
  rundown_id: string
  template_id: string
  label: string
  sort_order: number
  layer: number
  props: string
  on_screen: number
  revision: number
  updated_at: number
}

function mapRundown(row: RundownRow): Rundown {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    cuedInstanceId: row.cued_instance_id,
  }
}

function mapInstance(row: InstanceRow, cuedInstanceId: string | null): GraphicInstance {
  const intent = row.on_screen ? ('in' as const) : ('out' as const)
  return {
    id: row.id,
    rundownId: row.rundown_id,
    templateId: row.template_id,
    label: row.label,
    sortOrder: row.sort_order,
    layer: row.layer,
    props: JSON.parse(row.props) as Record<string, unknown>,
    playout: {
      intent,
      onScreen: intent === 'in',
      cued: cuedInstanceId === row.id,
      changedAt: row.updated_at,
    },
    revision: row.revision,
    updatedAt: row.updated_at,
  }
}

export function listRundowns(db: Database = getDb()): Rundown[] {
  return db
    .query<RundownRow, []>('select * from rundowns order by created_at desc')
    .all()
    .map(mapRundown)
}

export function getRundown(id: string, db: Database = getDb()): Rundown | null {
  const row = db.query<RundownRow, [string]>('select * from rundowns where id = ?').get(id)
  return row ? mapRundown(row) : null
}

export function createRundown(name: string, db: Database = getDb()): Rundown {
  const now = Date.now()
  const id = crypto.randomUUID()
  db.query(
    'insert into rundowns (id, name, created_at, updated_at, cued_instance_id) values (?, ?, ?, ?, null)',
  ).run(id, name, now, now)
  return getRundown(id, db)!
}

export function renameRundown(id: string, name: string, db: Database = getDb()): Rundown | null {
  const now = Date.now()
  const result = db
    .query('update rundowns set name = ?, updated_at = ? where id = ?')
    .run(name, now, id)
  if (result.changes === 0) return null
  return getRundown(id, db)
}

export function deleteRundown(id: string, db: Database = getDb()): boolean {
  const result = db.query('delete from rundowns where id = ?').run(id)
  return result.changes > 0
}

export function setCuedInstance(
  rundownId: string,
  instanceId: string | null,
  db: Database = getDb(),
): Rundown | null {
  const now = Date.now()
  const result = db
    .query('update rundowns set cued_instance_id = ?, updated_at = ? where id = ?')
    .run(instanceId, now, rundownId)
  if (result.changes === 0) return null
  return getRundown(rundownId, db)
}

export function listInstances(rundownId: string, db: Database = getDb()): GraphicInstance[] {
  const rundown = getRundown(rundownId, db)
  if (!rundown) return []
  return db
    .query<InstanceRow, [string]>(
      'select * from instances where rundown_id = ? order by sort_order asc, id asc',
    )
    .all(rundownId)
    .map((row) => mapInstance(row, rundown.cuedInstanceId))
}

export function getInstance(id: string, db: Database = getDb()): GraphicInstance | null {
  const row = db.query<InstanceRow, [string]>('select * from instances where id = ?').get(id)
  if (!row) return null
  const rundown = getRundown(row.rundown_id, db)
  return mapInstance(row, rundown?.cuedInstanceId ?? null)
}

export type CreateInstanceInput = {
  rundownId: string
  templateId: string
  label: string
  props: Record<string, unknown>
  layer?: number
  sortOrder?: number
}

export function createInstance(input: CreateInstanceInput, db: Database = getDb()): GraphicInstance {
  const now = Date.now()
  const id = crypto.randomUUID()
  const sortOrder =
    input.sortOrder ??
    (db
      .query<{ m: number | null }, [string]>('select max(sort_order) as m from instances where rundown_id = ?')
      .get(input.rundownId)?.m ?? -1) + 1

  db.query(
    `insert into instances
      (id, rundown_id, template_id, label, sort_order, layer, props, on_screen, revision, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, 0, 1, ?)`,
  ).run(
    id,
    input.rundownId,
    input.templateId,
    input.label,
    sortOrder,
    input.layer ?? 0,
    JSON.stringify(input.props),
    now,
  )

  return getInstance(id, db)!
}

export function deleteInstance(id: string, db: Database = getDb()): GraphicInstance | null {
  const existing = getInstance(id, db)
  if (!existing) return null

  // Clear cue pointer if this was cued.
  const rundown = getRundown(existing.rundownId, db)
  if (rundown?.cuedInstanceId === id) {
    setCuedInstance(existing.rundownId, null, db)
  }

  db.query('delete from instances where id = ?').run(id)
  return existing
}

export function updateInstanceLabel(
  id: string,
  label: string,
  db: Database = getDb(),
): GraphicInstance | null {
  const now = Date.now()
  const result = db
    .query('update instances set label = ?, revision = revision + 1, updated_at = ? where id = ?')
    .run(label, now, id)
  if (result.changes === 0) return null
  return getInstance(id, db)
}

export function updateInstanceProps(
  id: string,
  props: Record<string, unknown>,
  db: Database = getDb(),
): GraphicInstance | null {
  const now = Date.now()
  const result = db
    .query(
      'update instances set props = ?, revision = revision + 1, updated_at = ? where id = ?',
    )
    .run(JSON.stringify(props), now, id)
  if (result.changes === 0) return null
  return getInstance(id, db)
}

export function setInstanceOnScreen(
  id: string,
  onScreen: boolean,
  db: Database = getDb(),
): GraphicInstance | null {
  const now = Date.now()
  const result = db
    .query(
      'update instances set on_screen = ?, revision = revision + 1, updated_at = ? where id = ?',
    )
    .run(onScreen ? 1 : 0, now, id)
  if (result.changes === 0) return null
  return getInstance(id, db)
}

export function reorderInstances(
  rundownId: string,
  orderedIds: string[],
  db: Database = getDb(),
): GraphicInstance[] {
  const now = Date.now()
  const update = db.query(
    'update instances set sort_order = ?, revision = revision + 1, updated_at = ? where id = ? and rundown_id = ?',
  )
  const tx = db.transaction(() => {
    orderedIds.forEach((id, index) => {
      update.run(index, now, id, rundownId)
    })
  })
  tx()
  return listInstances(rundownId, db)
}

export function clearAllOnScreen(rundownId: string, db: Database = getDb()): GraphicInstance[] {
  const now = Date.now()
  db.query(
    'update instances set on_screen = 0, revision = revision + 1, updated_at = ? where rundown_id = ? and on_screen = 1',
  ).run(now, rundownId)
  return listInstances(rundownId, db)
}
