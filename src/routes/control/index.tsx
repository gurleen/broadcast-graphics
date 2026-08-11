import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Badge, Button, DataGrid, Panel, Spinner } from '@gurleen-ui/core'
import type { DataGridRow } from '@gurleen-ui/core'
import { useRundownList } from '#/control/client'
import { useState } from 'react'
import { CreateRundownDialog } from './-CreateRundownDialog'

export const Route = createFileRoute('/control/')({
  ssr: false,
  component: ControlIndex,
})

function ControlIndex() {
  const navigate = useNavigate()
  const { rundowns, loading, error, createRundown, refresh } = useRundownList()
  const [createOpen, setCreateOpen] = useState(false)

  const rows: DataGridRow[] = rundowns.map((r) => ({
    id: r.id,
    name: r.name,
    cued: r.cuedInstanceId ? 'YES' : '—',
    updated: new Date(r.updatedAt).toLocaleString(),
  }))

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
            Rundowns
          </div>
          <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>
            Select a rundown to open playout, templates, and renderer sessions.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Button label="REFRESH" size="sm" onClick={() => void refresh()} />
          <Button label="+ NEW RUNDOWN" size="sm" variant="accent" onClick={() => setCreateOpen(true)} />
        </div>
      </div>

      <Panel title="ALL RUNDOWNS" meta={String(rundowns.length)} padded={false} style={{ flex: 1, minHeight: 0 }}>
        {loading && rundowns.length === 0 ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}>
            <Spinner />
          </div>
        ) : error && rundowns.length === 0 ? (
          <div style={{ padding: 16, color: 'var(--err)', fontSize: 11 }}>{error}</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 16, color: 'var(--fg-3)', fontSize: 11 }}>
            No rundowns yet. Create one to start building a show.
          </div>
        ) : (
          <DataGrid
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'id', label: 'ID', width: '220px', dim: true },
              { key: 'cued', label: 'Cued', width: '60px', align: 'center', dim: true },
              { key: 'updated', label: 'Updated', width: '180px', dim: true },
            ]}
            rows={rows}
            height="100%"
            onSelect={(_, row) => {
              void navigate({
                to: '/control/$rundownId',
                params: { rundownId: String(row.id) },
              })
            }}
          />
        )}
      </Panel>

      {error ? <Badge kind="err" label={error} /> : null}

      <CreateRundownDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={createRundown}
      />
    </div>
  )
}
