import type { Database } from 'bun:sqlite'
import type { GraphicInstance, LiveDataRecord, PackageAttachment, Rundown } from '../model'
import { getDb } from './db'
import { deepMerge } from './util'

type RundownRow = {
  id: string
  name: string
  created_at: number
  updated_at: number
  cued_instance_id: string | null
  sort_order: number
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
    sortOrder: row.sort_order,
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
    .query<RundownRow, []>('select * from rundowns order by sort_order asc, id asc')
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
  const maxSort = db
    .query<{ m: number | null }, []>('select max(sort_order) as m from rundowns')
    .get()?.m
  const sortOrder = (maxSort ?? -1) + 1
  db.query(
    'insert into rundowns (id, name, created_at, updated_at, cued_instance_id, sort_order) values (?, ?, ?, ?, null, ?)',
  ).run(id, name, now, now, sortOrder)
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

export function reorderRundowns(orderedIds: string[], db: Database = getDb()): Rundown[] {
  const now = Date.now()
  const update = db.query('update rundowns set sort_order = ?, updated_at = ? where id = ?')
  const tx = db.transaction(() => {
    orderedIds.forEach((id, index) => {
      update.run(index, now, id)
    })
  })
  tx()
  return listRundowns(db)
}

const ACTIVE_RUNDOWN_KEY = 'active_rundown_id'

/** Global PGM pointer for `/render` (default composite). */
export function getActiveRundownId(db: Database = getDb()): string | null {
  const row = db
    .query<{ value: string }, [string]>('select value from meta where key = ?')
    .get(ACTIVE_RUNDOWN_KEY)
  return row?.value ?? null
}

/** Persist active rundown id, or clear when `null`. Caller must validate existence. */
export function setActiveRundownId(id: string | null, db: Database = getDb()): void {
  if (id === null) {
    db.query('delete from meta where key = ?').run(ACTIVE_RUNDOWN_KEY)
    return
  }
  db.query('insert or replace into meta (key, value) values (?, ?)').run(ACTIVE_RUNDOWN_KEY, id)
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
    .map((row) => applyLiveOverlay(mapInstance(row, rundown.cuedInstanceId)))
}

export function getInstance(id: string, db: Database = getDb()): GraphicInstance | null {
  const row = db.query<InstanceRow, [string]>('select * from instances where id = ?').get(id)
  if (!row) return null
  const rundown = getRundown(row.rundown_id, db)
  return applyLiveOverlay(mapInstance(row, rundown?.cuedInstanceId ?? null))
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

// ── Package attachments (per-rundown opt-in + config) ───────────────────────

type PackageAttachmentRow = {
  rundown_id: string
  package_id: string
  attached: number
  config: string
  attached_at: number
}

function mapAttachment(row: PackageAttachmentRow): PackageAttachment {
  return {
    packageId: row.package_id,
    attached: row.attached === 1,
    config: JSON.parse(row.config) as Record<string, unknown>,
    attachedAt: row.attached_at,
  }
}

/** Attached packages for a rundown. Pass `onlyAttached: false` to include detached rows (config kept). */
export function listPackageAttachments(
  rundownId: string,
  onlyAttached = true,
  db: Database = getDb(),
): PackageAttachment[] {
  const rows = onlyAttached
    ? db
        .query<PackageAttachmentRow, [string]>(
          'select * from rundown_packages where rundown_id = ? and attached = 1 order by package_id',
        )
        .all(rundownId)
    : db
        .query<PackageAttachmentRow, [string]>(
          'select * from rundown_packages where rundown_id = ? order by package_id',
        )
        .all(rundownId)
  return rows.map(mapAttachment)
}

export function getPackageAttachment(
  rundownId: string,
  packageId: string,
  db: Database = getDb(),
): PackageAttachment | null {
  const row = db
    .query<PackageAttachmentRow, [string, string]>(
      'select * from rundown_packages where rundown_id = ? and package_id = ?',
    )
    .get(rundownId, packageId)
  return row ? mapAttachment(row) : null
}

/** Attach (or re-attach) a package, preserving prior config unless `config` is given. */
export function attachPackage(
  rundownId: string,
  packageId: string,
  config?: Record<string, unknown>,
  db: Database = getDb(),
): PackageAttachment {
  const now = Date.now()
  const existing = getPackageAttachment(rundownId, packageId, db)
  const nextConfig = config ?? existing?.config ?? {}
  db.query(
    `insert into rundown_packages (rundown_id, package_id, attached, config, attached_at)
     values (?, ?, 1, ?, ?)
     on conflict(rundown_id, package_id) do update set
       attached = 1,
       config = excluded.config,
       attached_at = excluded.attached_at`,
  ).run(rundownId, packageId, JSON.stringify(nextConfig), now)
  return getPackageAttachment(rundownId, packageId, db)!
}

/** Detach a package, keeping its config so re-attaching restores it. */
export function detachPackage(
  rundownId: string,
  packageId: string,
  db: Database = getDb(),
): PackageAttachment | null {
  const existing = getPackageAttachment(rundownId, packageId, db)
  if (!existing) return null
  db.query(
    'update rundown_packages set attached = 0 where rundown_id = ? and package_id = ?',
  ).run(rundownId, packageId)
  return getPackageAttachment(rundownId, packageId, db)
}

export function patchPackageConfig(
  rundownId: string,
  packageId: string,
  patch: Record<string, unknown>,
  db: Database = getDb(),
): PackageAttachment | null {
  const existing = getPackageAttachment(rundownId, packageId, db)
  if (!existing) return null
  const merged = deepMerge(existing.config, patch)
  db.query('update rundown_packages set config = ? where rundown_id = ? and package_id = ?').run(
    JSON.stringify(merged),
    rundownId,
    packageId,
  )
  return getPackageAttachment(rundownId, packageId, db)
}

export function replacePackageConfig(
  rundownId: string,
  packageId: string,
  config: Record<string, unknown>,
  db: Database = getDb(),
): PackageAttachment | null {
  const existing = getPackageAttachment(rundownId, packageId, db)
  if (!existing) return null
  db.query('update rundown_packages set config = ? where rundown_id = ? and package_id = ?').run(
    JSON.stringify(config),
    rundownId,
    packageId,
  )
  return getPackageAttachment(rundownId, packageId, db)
}

// ── Rundown live-data store (ephemeral, in-memory, last-value-wins) ─────────

type DataEntry = { value: unknown; revision: number; updatedAt: number }
type DataState = Map<string, Map<string, DataEntry>>

type GlobalData = typeof globalThis & { __controllerData?: DataState }

function dataState(): DataState {
  const g = globalThis as GlobalData
  if (!g.__controllerData) g.__controllerData = new Map()
  return g.__controllerData
}

function dataKey(packageId: string, key: string): string {
  return `${packageId}\u0000${key}`
}

export function publishRundownData(
  rundownId: string,
  packageId: string,
  key: string,
  value: unknown,
): LiveDataRecord {
  const state = dataState()
  const bucket = state.get(rundownId) ?? new Map<string, DataEntry>()
  const compound = dataKey(packageId, key)
  const prevRevision = bucket.get(compound)?.revision ?? 0
  const entry: DataEntry = { value, revision: prevRevision + 1, updatedAt: Date.now() }
  bucket.set(compound, entry)
  state.set(rundownId, bucket)
  return { packageId, key, value: entry.value, revision: entry.revision, updatedAt: entry.updatedAt }
}

export function clearRundownData(rundownId: string, packageId: string, key: string): void {
  dataState().get(rundownId)?.delete(dataKey(packageId, key))
}

export function clearRundownDataAll(rundownId: string): void {
  dataState().delete(rundownId)
}

export function getRundownDataValue(rundownId: string, packageId: string, key: string): unknown {
  return dataState().get(rundownId)?.get(dataKey(packageId, key))?.value
}

export function listRundownData(rundownId: string): LiveDataRecord[] {
  const bucket = dataState().get(rundownId)
  if (!bucket) return []
  const out: LiveDataRecord[] = []
  for (const [compound, entry] of bucket) {
    const sep = compound.indexOf('\u0000')
    out.push({
      packageId: compound.slice(0, sep),
      key: compound.slice(sep + 1),
      value: entry.value,
      revision: entry.revision,
      updatedAt: entry.updatedAt,
    })
  }
  return out
}

// ── Live overlay (server-projected props, never persisted to SQLite) ───────

type OverlayEntry = { props: Record<string, unknown>; revision: number }
type OverlayState = Map<string, OverlayEntry>

type GlobalOverlay = typeof globalThis & { __controllerLiveOverlay?: OverlayState }

function overlayState(): OverlayState {
  const g = globalThis as GlobalOverlay
  if (!g.__controllerLiveOverlay) g.__controllerLiveOverlay = new Map()
  return g.__controllerLiveOverlay
}

function applyLiveOverlay(instance: GraphicInstance): GraphicInstance {
  const overlay = overlayState().get(instance.id)
  if (!overlay) return instance
  return {
    ...instance,
    props: deepMerge(instance.props, overlay.props),
    revision: Math.max(instance.revision, overlay.revision),
  }
}

/**
 * Merge a live-projected props patch into an instance's overlay. Never touches
 * SQLite — safe to call at clock/score tick rates. Returns the effective
 * (persisted + overlay) instance, or `null` if the instance doesn't exist.
 */
export function setLiveOverlayProps(
  instanceId: string,
  patch: Record<string, unknown>,
  db: Database = getDb(),
): GraphicInstance | null {
  const row = db.query<InstanceRow, [string]>('select * from instances where id = ?').get(instanceId)
  if (!row) return null
  const rundown = getRundown(row.rundown_id, db)
  const persisted = mapInstance(row, rundown?.cuedInstanceId ?? null)

  const state = overlayState()
  const existing = state.get(instanceId)
  const nextProps = deepMerge(existing?.props ?? {}, patch)
  const nextRevision = Math.max(existing?.revision ?? 0, persisted.revision) + 1
  state.set(instanceId, { props: nextProps, revision: nextRevision })

  return applyLiveOverlay(persisted)
}

export function clearLiveOverlay(instanceId: string): void {
  overlayState().delete(instanceId)
}

/** Test helper. */
export function resetLiveDataCache(): void {
  const g = globalThis as GlobalData & GlobalOverlay
  g.__controllerData = undefined
  g.__controllerLiveOverlay = undefined
}
