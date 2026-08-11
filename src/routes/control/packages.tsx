import { useCallback, useEffect, useRef, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Badge, Button, Panel, Spinner } from '@gurleen-ui/core'

export const Route = createFileRoute('/control/packages')({
  ssr: false,
  component: PackagesPage,
})

type PackageRow = {
  id: string
  name: string
  version: string
  contentHash: string
  formatVersion: number
  bundleUrl: string
  error: string | null
  templateIds: string[]
  templateCount: number
}

function PackagesPage() {
  const [packages, setPackages] = useState<PackageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/control/packages')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = (await res.json()) as { packages?: PackageRow[] }
      setPackages(body.packages ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load packages')
      setPackages([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const reload = async () => {
    setBusy(true)
    try {
      await fetch('/api/control/packages/reload', { method: 'POST' })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reload failed')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm(`Remove package ${id}?`)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/control/packages/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string }
        } | null
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`)
      }
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Remove failed')
    } finally {
      setBusy(false)
    }
  }

  const onUpload = async (file: File) => {
    setBusy(true)
    setError(null)
    try {
      const form = new FormData()
      form.set('file', file, file.name)
      const res = await fetch('/api/control/packages', { method: 'POST', body: form })
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean
        error?: { message?: string }
      } | null
      if (!res.ok || !body?.ok) {
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`)
      }
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Packages
          </div>
          <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>
            Install compiled <code>.hgfx.js</code> template packages. Drop files into{' '}
            <code>data/packages/</code> or upload below.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Link
            to="/control"
            style={{
              fontSize: 11,
              color: 'var(--fg-2)',
              textDecoration: 'none',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            ← Rundowns
          </Link>
          <Button label="RELOAD" size="sm" disabled={busy} onClick={() => void reload()} />
          <Button
            label="+ UPLOAD"
            size="sm"
            variant="accent"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          />
          <input
            ref={fileRef}
            type="file"
            accept=".js,.hgfx.js"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void onUpload(f)
            }}
          />
        </div>
      </div>

      <Panel
        title="INSTALLED"
        meta={String(packages.length)}
        padded={false}
        style={{ flex: 1, minHeight: 0, overflow: 'auto' }}
      >
        {loading && packages.length === 0 ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}>
            <Spinner />
          </div>
        ) : packages.length === 0 ? (
          <div style={{ padding: 16, color: 'var(--fg-3)', fontSize: 11 }}>
            No packages installed. Build one with <code>hydra-gfx build</code> and upload the{' '}
            <code>.hgfx.js</code> artifact.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 12,
                  padding: '12px 14px',
                  borderBottom: '1px solid var(--line-1)',
                  alignItems: 'start',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 12, letterSpacing: '0.06em' }}>
                      {pkg.name}
                    </span>
                    <Badge kind="neutral" label={`v${pkg.version}`} />
                    <Badge
                      kind={pkg.error ? 'err' : 'info'}
                      label={pkg.error ? 'ERROR' : `${pkg.templateCount} TPL`}
                    />
                    {pkg.contentHash ? (
                      <Badge kind="neutral" label={pkg.contentHash.slice(0, 8)} />
                    ) : null}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 4 }}>
                    id <code>{pkg.id}</code>
                    {pkg.templateIds.length ? (
                      <>
                        {' '}
                        · templates{' '}
                        {pkg.templateIds.map((id) => (
                          <code key={id} style={{ marginRight: 6 }}>
                            {id}
                          </code>
                        ))}
                      </>
                    ) : null}
                  </div>
                  {pkg.error ? (
                    <div style={{ fontSize: 11, color: 'var(--err)', marginTop: 6 }}>{pkg.error}</div>
                  ) : null}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button
                    label="REMOVE"
                    size="sm"
                    disabled={busy}
                    onClick={() => void remove(pkg.id)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {error ? <Badge kind="err" label={error} /> : null}
    </div>
  )
}
