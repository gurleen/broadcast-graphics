import { useEffect, useState } from 'react'

const POLL_MS = 1000

async function fetchActiveRundownId(): Promise<string | null> {
  const res = await fetch('/api/control/active-rundown')
  if (!res.ok) return null
  const body = (await res.json()) as { rundownId?: string | null }
  return typeof body.rundownId === 'string' ? body.rundownId : null
}

/** Mark a rundown as the default `/render` target (fire-and-forget). */
export function setActiveRundown(rundownId: string): void {
  void fetch('/api/control/active-rundown', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ rundownId }),
  }).catch(() => {
    // ignore — control UI should not block on PGM pointer
  })
}

/**
 * Follow the server's active rundown pointer (for `/render`).
 * Polls REST and also reacts to WS-driven `hydra:active-rundown-changed`.
 */
export function useActiveRundownId(): string | null {
  const [rundownId, setRundownId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const apply = (id: string | null) => {
      if (!cancelled) setRundownId(id)
    }

    const tick = async () => {
      try {
        const id = await fetchActiveRundownId()
        apply(id)
      } catch {
        // keep last known id
      }
    }

    void tick()
    const interval = window.setInterval(() => void tick(), POLL_MS)

    const onChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ rundownId?: string | null }>).detail
      if (detail && 'rundownId' in detail) {
        apply(typeof detail.rundownId === 'string' ? detail.rundownId : null)
      } else {
        void tick()
      }
    }
    window.addEventListener('hydra:active-rundown-changed', onChanged)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.removeEventListener('hydra:active-rundown-changed', onChanged)
    }
  }, [])

  return rundownId
}
