import { useCallback, useEffect, useState } from 'react'
import type { PackagePublicMeta, TemplatePublicMeta } from '#/templates/schemas'

export type TemplateCatalogState = {
  templates: TemplatePublicMeta[]
  packages: PackagePublicMeta[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

/**
 * Fetch the registered template catalog from REST (`GET /api/control/templates`).
 */
export function useTemplateCatalog(): TemplateCatalogState {
  const [templates, setTemplates] = useState<TemplatePublicMeta[]>([])
  const [packages, setPackages] = useState<PackagePublicMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const res = await fetch('/api/control/templates')
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const body = (await res.json()) as {
        templates?: TemplatePublicMeta[]
        packages?: PackagePublicMeta[]
      }
      setTemplates(body.templates ?? [])
      setPackages(body.packages ?? [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates')
      if (!opts?.silent) {
        setTemplates([])
        setPackages([])
      }
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const onPackagesChanged = () => {
      void refresh({ silent: true })
    }
    window.addEventListener('hydra:packages-changed', onPackagesChanged)
    return () => window.removeEventListener('hydra:packages-changed', onPackagesChanged)
  }, [refresh])

  return {
    templates,
    packages,
    loading,
    error,
    refresh: () => refresh(),
  }
}
