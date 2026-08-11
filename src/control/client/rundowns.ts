import { useCallback, useEffect, useState } from 'react'
import type { Rundown } from '../model'

export type RundownListState = {
  rundowns: Rundown[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  createRundown: (name: string) => Promise<Rundown | null>
  renameRundown: (id: string, name: string) => Promise<boolean>
  deleteRundown: (id: string) => Promise<boolean>
  reorderRundowns: (orderedIds: string[]) => Promise<boolean>
}

/**
 * Fetch and manage the rundown list via REST (`GET/POST /api/control/rundowns`).
 */
export function useRundownList(): RundownListState {
  const [rundowns, setRundowns] = useState<Rundown[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/control/rundowns')
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const body = (await res.json()) as { rundowns?: Rundown[] }
      setRundowns(body.rundowns ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rundowns')
      setRundowns([])
    } finally {
      setLoading(false)
    }
  }, [])

  const createRundown = useCallback(
    async (name: string): Promise<Rundown | null> => {
      try {
        const res = await fetch('/api/control/rundowns', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name }),
        })
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }
        const body = (await res.json()) as { ok?: boolean; rundown?: Rundown; error?: { message?: string } }
        if (!body.ok || !body.rundown) {
          throw new Error(body.error?.message ?? 'Create failed')
        }
        await refresh()
        return body.rundown
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create rundown')
        return null
      }
    },
    [refresh],
  )

  const renameRundown = useCallback(
    async (id: string, name: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/control/rundowns/${id}/commands`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ type: 'rundown.rename', name }),
        })
        const body = (await res.json()) as { ok?: boolean; error?: { message?: string } }
        if (!res.ok || !body.ok) {
          throw new Error(body.error?.message ?? `HTTP ${res.status}`)
        }
        await refresh()
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to rename rundown')
        return false
      }
    },
    [refresh],
  )

  const deleteRundown = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/control/rundowns/${id}/commands`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ type: 'rundown.delete' }),
        })
        const body = (await res.json()) as { ok?: boolean; error?: { message?: string } }
        if (!res.ok || !body.ok) {
          throw new Error(body.error?.message ?? `HTTP ${res.status}`)
        }
        await refresh()
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete rundown')
        return false
      }
    },
    [refresh],
  )

  const reorderRundowns = useCallback(
    async (orderedIds: string[]): Promise<boolean> => {
      try {
        const res = await fetch('/api/control/rundowns/reorder', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ orderedIds }),
        })
        const body = (await res.json()) as {
          ok?: boolean
          rundowns?: Rundown[]
          error?: { message?: string }
        }
        if (!res.ok || !body.ok) {
          throw new Error(body.error?.message ?? `HTTP ${res.status}`)
        }
        if (body.rundowns) {
          setRundowns(body.rundowns)
        } else {
          await refresh()
        }
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to reorder rundowns')
        return false
      }
    },
    [refresh],
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    rundowns,
    loading,
    error,
    refresh,
    createRundown,
    renameRundown,
    deleteRundown,
    reorderRundowns,
  }
}
