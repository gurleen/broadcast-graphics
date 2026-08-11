import { useCallback, useEffect, useState } from 'react'
import type { TemplatePublicMeta } from '#/templates/schemas'

export type TemplateCatalogState = {
  templates: TemplatePublicMeta[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

/**
 * Fetch the registered template catalog from REST (`GET /api/control/templates`).
 */
export function useTemplateCatalog(): TemplateCatalogState {
  const [templates, setTemplates] = useState<TemplatePublicMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/control/templates')
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const body = (await res.json()) as { templates?: TemplatePublicMeta[] }
      setTemplates(body.templates ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates')
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { templates, loading, error, refresh }
}
