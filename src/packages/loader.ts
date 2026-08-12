/**
 * Browser loader for dynamic `.hgfx.js` packages.
 */
import type { ComponentType } from 'react'
import type {
  PackagePanelProps,
  TemplateControlsProps,
  TemplateDefinition,
  TemplateRenderProps,
  TemplateSchema,
} from '#/templates/types'
import { installClientRuntime } from './runtime'

export type PackageCatalogEntry = {
  id: string
  name: string
  version: string
  bundleUrl: string
  contentHash: string
  error?: string | null
  templateIds?: string[]
}

export type ResolvedClientPanel = {
  id: string
  label: string
  Panel: ComponentType<PackagePanelProps<Record<string, unknown>>>
}

export type LoadedClientPackage = {
  id: string
  name: string
  version: string
  contentHash: string
  templates: Map<string, ResolvedClientTemplate>
  panels: Map<string, ResolvedClientPanel>
}

export type ResolvedClientTemplate = TemplateDefinition<Record<string, unknown>> & {
  packageId: string
}

type PackageModule = {
  default: {
    id: string
    name: string
    version: string
    panels?: Array<{
      id: string
      label: string
      Panel: () => Promise<unknown>
    }>
    templates: Array<{
      id: string
      name: string
      schema: TemplateSchema<Record<string, unknown>>['schema']
      defaults: Record<string, unknown>
      fields?: TemplateSchema<Record<string, unknown>>['fields']
      transition?: TemplateSchema<Record<string, unknown>>['transition']
      Render: () => Promise<unknown>
      Controls?: () => Promise<unknown>
      PreviewControls?: () => Promise<unknown>
    }>
  }
  manifest?: {
    formatVersion: number
    package: { id: string; name: string; version: string }
    templates: Array<{ id: string; name: string }>
    panels?: Array<{ id: string; label: string }>
  }
}

type CacheEntry = {
  promise: Promise<LoadedClientPackage>
  value?: LoadedClientPackage
  contentHash: string
}

const cache = new Map<string, CacheEntry>()
const listeners = new Set<() => void>()

function notify() {
  for (const l of listeners) l()
}

export function subscribePackageLoads(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

async function resolveExport(mod: unknown): Promise<ComponentType<never> | undefined> {
  if (!mod) return undefined
  if (typeof mod === 'function') return mod as ComponentType<never>
  if (typeof mod === 'object') {
    const obj = mod as Record<string, unknown>
    if (typeof obj.default === 'function') return obj.default as ComponentType<never>
    // Named export: pick first function export
    for (const v of Object.values(obj)) {
      if (typeof v === 'function') return v as ComponentType<never>
    }
  }
  return undefined
}

async function resolveTemplate(
  pkgId: string,
  t: PackageModule['default']['templates'][number],
): Promise<ResolvedClientTemplate> {
  const Render = (await resolveExport(await t.Render())) as ComponentType<
    TemplateRenderProps<Record<string, unknown>>
  >
  if (!Render) throw new Error(`Template ${t.id} Render factory returned nothing`)

  const Controls = t.Controls
    ? ((await resolveExport(await t.Controls())) as
        | ComponentType<TemplateControlsProps<Record<string, unknown>>>
        | undefined)
    : undefined

  return {
    id: t.id,
    name: t.name,
    route: `/graphics/p/${pkgId}/${t.id}`,
    schema: t.schema,
    defaults: t.defaults,
    fields: t.fields,
    transition: t.transition,
    packageId: pkgId,
    Render,
    Controls,
  }
}

async function resolvePanel(
  p: NonNullable<PackageModule['default']['panels']>[number],
): Promise<ResolvedClientPanel> {
  const Panel = (await resolveExport(await p.Panel())) as
    | ComponentType<PackagePanelProps<Record<string, unknown>>>
    | undefined
  if (!Panel) throw new Error(`Panel ${p.id} factory returned nothing`)
  return { id: p.id, label: p.label, Panel }
}

export async function loadPackage(
  entry: PackageCatalogEntry,
): Promise<LoadedClientPackage> {
  installClientRuntime()
  const existing = cache.get(entry.id)
  if (existing && existing.contentHash === entry.contentHash) {
    return existing.value ?? existing.promise
  }

  const url = `${entry.bundleUrl}?v=${encodeURIComponent(entry.contentHash)}`
  const promise = (async () => {
    const mod = (await import(/* @vite-ignore */ url)) as PackageModule
    const pkg = mod.default
    if (!pkg?.id || !Array.isArray(pkg.templates)) {
      throw new Error(`Invalid package module at ${url}`)
    }
    const templates = new Map<string, ResolvedClientTemplate>()
    for (const t of pkg.templates) {
      templates.set(t.id, await resolveTemplate(pkg.id, t))
    }
    const panels = new Map<string, ResolvedClientPanel>()
    for (const p of pkg.panels ?? []) {
      panels.set(p.id, await resolvePanel(p))
    }
    const loaded: LoadedClientPackage = {
      id: pkg.id,
      name: pkg.name,
      version: pkg.version,
      contentHash: entry.contentHash,
      templates,
      panels,
    }
    const slot = cache.get(entry.id)
    if (slot) slot.value = loaded
    notify()
    return loaded
  })()

  cache.set(entry.id, { promise, contentHash: entry.contentHash })
  try {
    return await promise
  } catch (err) {
    cache.delete(entry.id)
    throw err
  }
}

export function getCachedTemplate(
  templateId: string,
): ResolvedClientTemplate | undefined {
  for (const entry of cache.values()) {
    const hit = entry.value?.templates.get(templateId)
    if (hit) return hit
  }
  return undefined
}

export function getCachedPackage(packageId: string): LoadedClientPackage | undefined {
  return cache.get(packageId)?.value
}

export function evictPackage(packageId: string): void {
  cache.delete(packageId)
  notify()
}

export function clearPackageCache(): void {
  cache.clear()
  notify()
}

/** Resolve a package control panel component (loads the package bundle if needed). */
export async function loadPackagePanel(
  entry: PackageCatalogEntry,
  panelId: string,
): Promise<ResolvedClientPanel | undefined> {
  const loaded = await loadPackage(entry)
  return loaded.panels.get(panelId)
}

/** Resolve PreviewControls for a package template (optional). */
export async function loadPreviewControls(
  entry: PackageCatalogEntry,
  templateId: string,
): Promise<ComponentType<TemplateControlsProps<Record<string, unknown>>> | undefined> {
  const loaded = await loadPackage(entry)
  // PreviewControls aren't stored on ResolvedClientTemplate — re-import factory from module
  void loaded
  installClientRuntime()
  const url = `${entry.bundleUrl}?v=${encodeURIComponent(entry.contentHash)}`
  const mod = (await import(/* @vite-ignore */ url)) as PackageModule
  const t = mod.default.templates.find((x) => x.id === templateId)
  if (!t?.PreviewControls) return undefined
  return (await resolveExport(await t.PreviewControls())) as
    | ComponentType<TemplateControlsProps<Record<string, unknown>>>
    | undefined
}
