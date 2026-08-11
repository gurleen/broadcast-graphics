/**
 * React hooks for resolving dynamic template components.
 */
import { useEffect, useMemo, useState } from 'react'
import type { TemplateDefinition } from '#/templates/types'
import type { PackagePublicMeta } from '#/templates/schemas'
import { getTemplateDefinition } from '#/templates/registry-static'
import {
  getCachedTemplate,
  loadPackage,
  subscribePackageLoads,
  type PackageCatalogEntry,
} from './loader'
import { installClientRuntime } from './runtime'

function catalogToEntry(p: PackagePublicMeta): PackageCatalogEntry {
  return {
    id: p.id,
    name: p.name,
    version: p.version,
    bundleUrl: p.bundleUrl,
    contentHash: p.contentHash,
    error: p.error,
    templateIds: p.templateIds,
  }
}

/**
 * Ensure packages for the given template ids are loaded. Returns a map of
 * templateId → definition (static or dynamic).
 */
export function useTemplateComponents(
  templateIds: string[],
  packages: PackagePublicMeta[] = [],
): {
  byId: Map<string, TemplateDefinition<Record<string, unknown>>>
  loading: boolean
  error: string | null
} {
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const idsKey = [...templateIds].sort().join(',')
  const pkgKey = packages.map((p) => `${p.id}@${p.contentHash}`).join(',')

  useEffect(() => {
    installClientRuntime()
    const needed = templateIds.filter(
      (id) => !getTemplateDefinition(id) && !getCachedTemplate(id),
    )
    if (!needed.length) return

    const neededSet = new Set(needed)
    const toLoad = packages.filter(
      (p) =>
        !p.error &&
        p.contentHash &&
        (p.templateIds.some((id) => neededSet.has(id)) ||
          // Fallback: load all healthy packages when catalog lacks templateIds
          p.templateIds.length === 0),
    )

    // If nothing matched by templateIds, load all healthy packages as last resort
    const entries = (
      toLoad.length ? toLoad : packages.filter((p) => !p.error && p.contentHash)
    ).map(catalogToEntry)

    if (!entries.length) return

    let cancelled = false
    setError(null)
    void Promise.all(
      [...new Map(entries.map((p) => [p.id, p])).values()].map((p) => loadPackage(p)),
    )
      .then(() => {
        if (!cancelled) setTick((t) => t + 1)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })

    return () => {
      cancelled = true
    }
  }, [idsKey, pkgKey, templateIds, packages])

  useEffect(() => subscribePackageLoads(() => setTick((t) => t + 1)), [])

  const byId = useMemo(() => {
    const map = new Map<string, TemplateDefinition<Record<string, unknown>>>()
    for (const id of templateIds) {
      const def = getTemplateDefinition(id) ?? getCachedTemplate(id)
      if (def) map.set(id, def)
    }
    void tick
    return map
  }, [templateIds, tick])

  const loading = templateIds.some(
    (id) => !getTemplateDefinition(id) && !getCachedTemplate(id),
  )

  return { byId, loading, error }
}

export function resolveTemplateDefinition(id: string) {
  return getTemplateDefinition(id) ?? getCachedTemplate(id)
}
