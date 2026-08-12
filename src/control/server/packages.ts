/**
 * Dynamic template package store — scans data/packages/*.hgfx.js, imports schemas,
 * and keeps an in-memory catalog merged with the static registry.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, watch, type FSWatcher } from 'node:fs'
import { readdir, readFile, writeFile, unlink, mkdir } from 'node:fs/promises'
import path from 'node:path'
import type { z } from 'zod'
import type {
  DatasetDeclaration,
  ProviderDefinition,
} from '#/templates/types'
import type { TemplateSchema } from '#/templates/types'
import { installServerRuntime } from '#/packages/runtime.server'
import { getDb } from './db'
import { publish } from './hub'

export function getPackagesDir(): string {
  return process.env.HYDRA_PACKAGES_DIR ?? 'data/packages'
}

/** @deprecated Prefer getPackagesDir() — env may change in tests. */
export const PACKAGES_DIR = 'data/packages'
export const FORMAT_VERSION = 1

export type InstalledPackageRecord = {
  id: string
  file: string
  name: string
  version: string
  contentHash: string
  formatVersion: number
  enabled: boolean
  source: string
  installedAt: number
  error: string | null
}

export type LoadedPackageTemplate = TemplateSchema<Record<string, unknown>> & {
  packageId: string
  /** Lazy factories from the artifact (not resolved on the server). */
  RenderFactory?: () => Promise<unknown>
  ControlsFactory?: () => Promise<unknown>
  PreviewControlsFactory?: () => Promise<unknown>
}

export type LoadedPackageConfig = {
  schema: z.ZodType<Record<string, unknown>>
  defaults: Record<string, unknown>
  fields?: TemplateSchema<Record<string, unknown>>['fields']
}

export type LoadedPackage = {
  id: string
  name: string
  version: string
  contentHash: string
  formatVersion: number
  filePath: string
  bundleUrl: string
  templates: LoadedPackageTemplate[]
  /** Package-level operator config schema, if declared. */
  config?: LoadedPackageConfig
  /** Rundown-scoped live-data key schemas, keyed by name. */
  dataSchemas?: Record<string, z.ZodType<unknown>>
  /** Remote reference datasets the package wants cached. */
  datasets?: DatasetDeclaration[]
  /** In-process live-data providers (executable — server-only, never sent to clients). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  providers?: ProviderDefinition<any>[]
  error: string | null
}

type PackageModule = {
  default?: {
    id: string
    name: string
    version: string
    config?: {
      schema: z.ZodType<Record<string, unknown>>
      defaults: Record<string, unknown>
      fields?: TemplateSchema<Record<string, unknown>>['fields']
    }
    data?: Record<string, z.ZodType<unknown>>
    datasets?: DatasetDeclaration[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    providers?: ProviderDefinition<any>[]
    templates: Array<{
      id: string
      name: string
      schema: z.ZodType<Record<string, unknown>>
      defaults: Record<string, unknown>
      fields?: TemplateSchema<Record<string, unknown>>['fields']
      transition?: TemplateSchema<Record<string, unknown>>['transition']
      live?: TemplateSchema<Record<string, unknown>>['live']
      Render?: () => Promise<unknown>
      Controls?: () => Promise<unknown>
      PreviewControls?: () => Promise<unknown>
    }>
  }
  manifest?: {
    formatVersion: number
    runtime: string
    package: { id: string; name: string; version: string }
    templates: Array<{
      id: string
      name: string
      defaults: Record<string, unknown>
      fields?: TemplateSchema<Record<string, unknown>>['fields']
      transition?: TemplateSchema<Record<string, unknown>>['transition']
      jsonSchema: Record<string, unknown>
    }>
  }
}

type CacheState = {
  packages: Map<string, LoadedPackage>
  templatesById: Map<string, LoadedPackageTemplate>
  watcher: FSWatcher | null
  ready: boolean
}

type GlobalPkgs = typeof globalThis & { __hydraPackages?: CacheState }

function state(): CacheState {
  const g = globalThis as GlobalPkgs
  if (!g.__hydraPackages) {
    g.__hydraPackages = {
      packages: new Map(),
      templatesById: new Map(),
      watcher: null,
      ready: false,
    }
  }
  return g.__hydraPackages
}

function ensureDir() {
  mkdirSync(getPackagesDir(), { recursive: true })
}

function hashBytes(buf: Buffer | Uint8Array): string {
  return createHash('sha256').update(buf).digest('hex').slice(0, 16)
}

function upsertDbRow(row: InstalledPackageRecord) {
  const db = getDb()
  db.query(
    `insert into packages (id, file, name, version, content_hash, format_version, enabled, source, installed_at, error)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     on conflict(id) do update set
       file = excluded.file,
       name = excluded.name,
       version = excluded.version,
       content_hash = excluded.content_hash,
       format_version = excluded.format_version,
       enabled = excluded.enabled,
       source = excluded.source,
       installed_at = excluded.installed_at,
       error = excluded.error`,
  ).run(
    row.id,
    row.file,
    row.name,
    row.version,
    row.contentHash,
    row.formatVersion,
    row.enabled ? 1 : 0,
    row.source,
    row.installedAt,
    row.error,
  )
}

function deleteDbRow(id: string) {
  getDb().query('delete from packages where id = ?').run(id)
}

function listDbRows(): InstalledPackageRecord[] {
  return getDb()
    .query<
      {
        id: string
        file: string
        name: string
        version: string
        content_hash: string
        format_version: number
        enabled: number
        source: string
        installed_at: number
        error: string | null
      },
      []
    >(`select * from packages order by id`)
    .all()
    .map((r) => ({
      id: r.id,
      file: r.file,
      name: r.name,
      version: r.version,
      contentHash: r.content_hash,
      formatVersion: r.format_version,
      enabled: r.enabled === 1,
      source: r.source,
      installedAt: r.installed_at,
      error: r.error,
    }))
}

async function importPackageFile(filePath: string, contentHash: string): Promise<LoadedPackage> {
  installServerRuntime()
  const abs = path.resolve(filePath)
  const mod = (await import(`${abs}?v=${contentHash}`)) as PackageModule
  const pkg = mod.default
  const manifest = mod.manifest

  if (!pkg?.id || !Array.isArray(pkg.templates)) {
    throw new Error('Artifact must default-export definePackage({ id, templates })')
  }
  if (manifest && manifest.formatVersion !== FORMAT_VERSION) {
    throw new Error(
      `Unsupported formatVersion ${manifest.formatVersion} (host supports ${FORMAT_VERSION})`,
    )
  }

  const templates: LoadedPackageTemplate[] = pkg.templates.map((t) => ({
    id: t.id,
    name: t.name,
    route: `/graphics/p/${pkg.id}/${t.id}`,
    schema: t.schema,
    defaults: t.defaults,
    fields: t.fields,
    transition: t.transition,
    live: t.live,
    packageId: pkg.id,
    RenderFactory: t.Render,
    ControlsFactory: t.Controls,
    PreviewControlsFactory: t.PreviewControls,
  }))

  return {
    id: pkg.id,
    name: pkg.name,
    version: pkg.version,
    contentHash,
    formatVersion: manifest?.formatVersion ?? FORMAT_VERSION,
    filePath: abs,
    bundleUrl: `/api/control/packages/${pkg.id}/bundle.js`,
    templates,
    config: pkg.config,
    dataSchemas: pkg.data,
    datasets: pkg.datasets,
    providers: pkg.providers,
    error: null,
  }
}

function rebuildIndex(packages: Map<string, LoadedPackage>) {
  const templatesById = new Map<string, LoadedPackageTemplate>()
  for (const pkg of packages.values()) {
    if (pkg.error) continue
    for (const t of pkg.templates) {
      templatesById.set(t.id, t)
    }
  }
  const s = state()
  s.packages = packages
  s.templatesById = templatesById
}

function broadcastChanged() {
  // Broadcast to all rundown subscribers via a synthetic rundown id.
  publish('*', { type: 'packages.changed', at: Date.now() })
}

export async function reloadPackages(): Promise<LoadedPackage[]> {
  ensureDir()
  installServerRuntime()
  const files = (await readdir(getPackagesDir())).filter((f) => f.endsWith('.hgfx.js'))
  const next = new Map<string, LoadedPackage>()
  const seenIds = new Set<string>()

  for (const file of files) {
    const filePath = path.join(getPackagesDir(), file)
    try {
      const buf = await readFile(filePath)
      const contentHash = hashBytes(buf)
      const loaded = await importPackageFile(filePath, contentHash)
      seenIds.add(loaded.id)
      next.set(loaded.id, loaded)
      upsertDbRow({
        id: loaded.id,
        file: path.basename(filePath),
        name: loaded.name,
        version: loaded.version,
        contentHash: loaded.contentHash,
        formatVersion: loaded.formatVersion,
        enabled: true,
        source: 'disk',
        installedAt: Date.now(),
        error: null,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[packages] failed to load ${file}:`, message)
      const id = file.replace(/\.hgfx\.js$/, '')
      next.set(id, {
        id,
        name: id,
        version: '0.0.0',
        contentHash: '',
        formatVersion: FORMAT_VERSION,
        filePath,
        bundleUrl: `/api/control/packages/${id}/bundle.js`,
        templates: [],
        error: message,
      })
      upsertDbRow({
        id,
        file,
        name: id,
        version: '0.0.0',
        contentHash: '',
        formatVersion: FORMAT_VERSION,
        enabled: false,
        source: 'disk',
        installedAt: Date.now(),
        error: message,
      })
    }
  }

  // Remove DB rows for packages no longer on disk
  for (const row of listDbRows()) {
    if (!seenIds.has(row.id) && !next.has(row.id)) {
      deleteDbRow(row.id)
    }
  }

  rebuildIndex(next)
  state().ready = true
  broadcastChanged()
  return [...next.values()]
}

export async function ensurePackagesLoaded(): Promise<void> {
  if (state().ready) return
  await reloadPackages()
}

export function listLoadedPackages(): LoadedPackage[] {
  return [...state().packages.values()]
}

export function getLoadedPackage(id: string): LoadedPackage | undefined {
  return state().packages.get(id)
}

export function getDynamicTemplateSchema(
  id: string,
): LoadedPackageTemplate | undefined {
  return state().templatesById.get(id)
}

export function listDynamicTemplates(): LoadedPackageTemplate[] {
  return [...state().templatesById.values()]
}

export async function installPackageFile(
  filename: string,
  bytes: Uint8Array,
  source = 'upload',
): Promise<LoadedPackage> {
  ensureDir()
  if (!filename.endsWith('.hgfx.js')) {
    throw new Error('Package file must end with .hgfx.js')
  }
  const dest = path.join(getPackagesDir(), path.basename(filename))
  await writeFile(dest, bytes)
  await reloadPackages()
  const idGuess = path.basename(filename, '.hgfx.js')
  const loaded =
    [...state().packages.values()].find((p) => p.filePath === path.resolve(dest)) ??
    state().packages.get(idGuess)
  if (!loaded) throw new Error('Package installed but failed to load')
  if (loaded.error) throw new Error(loaded.error)
  // Update source tag
  upsertDbRow({
    id: loaded.id,
    file: path.basename(loaded.filePath),
    name: loaded.name,
    version: loaded.version,
    contentHash: loaded.contentHash,
    formatVersion: loaded.formatVersion,
    enabled: true,
    source,
    installedAt: Date.now(),
    error: null,
  })
  return loaded
}

export async function removePackage(id: string): Promise<void> {
  const pkg = state().packages.get(id)
  if (pkg?.filePath) {
    try {
      await unlink(pkg.filePath)
    } catch {
      // may already be gone
    }
  }
  deleteDbRow(id)
  await reloadPackages()
}

export async function readPackageBundle(
  id: string,
): Promise<{ bytes: Buffer; contentHash: string; fileName: string } | null> {
  await ensurePackagesLoaded()
  const pkg = state().packages.get(id)
  if (!pkg || pkg.error) return null
  const bytes = await readFile(pkg.filePath)
  return { bytes, contentHash: pkg.contentHash, fileName: path.basename(pkg.filePath) }
}

export function startPackagesWatcher(): void {
  const s = state()
  if (s.watcher) return
  ensureDir()
  let timer: ReturnType<typeof setTimeout> | null = null
  s.watcher = watch(getPackagesDir(), { persistent: false }, () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      void reloadPackages().catch((err) => console.error('[packages] reload failed', err))
    }, 200)
  })
}

/** Test helper: inject a fully-formed package without going through disk/import. */
export function registerTestPackage(pkg: LoadedPackage): void {
  const next = new Map(state().packages)
  next.set(pkg.id, pkg)
  rebuildIndex(next)
  state().ready = true
}

/** Test helper. */
export function resetPackagesCache(): void {
  const s = state()
  if (s.watcher) {
    try {
      s.watcher.close()
    } catch {
      // ignore
    }
  }
  const g = globalThis as GlobalPkgs
  g.__hydraPackages = undefined
}

export async function ensurePackagesDir(): Promise<void> {
  await mkdir(getPackagesDir(), { recursive: true })
}
