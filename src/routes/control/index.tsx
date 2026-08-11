import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Badge, Button, DataGrid, Dialog, Input, Panel, Spinner, useToast } from '@hydra-tv/ui'
import type { DataGridRow } from '@hydra-tv/ui'
import { useRundownList } from '#/control/client'
import { useMemo, useState } from 'react'
import { CreateRundownDialog } from './-CreateRundownDialog'

export const Route = createFileRoute('/control/')({
  ssr: false,
  component: ControlIndex,
})

function ControlIndex() {
  const navigate = useNavigate()
  const toast = useToast()
  const {
    rundowns,
    loading,
    error,
    createRundown,
    refresh,
    renameRundown,
    deleteRundown,
    reorderRundowns,
  } = useRundownList()
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameName, setRenameName] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)

  const selected = useMemo(
    () => (selectedId ? rundowns.find((r) => r.id === selectedId) ?? null : null),
    [rundowns, selectedId],
  )
  const selectedIndex = selected ? rundowns.findIndex((r) => r.id === selected.id) : -1

  const rows: DataGridRow[] = rundowns.map((r) => ({
    id: r.id,
    name: r.name,
    cued: r.cuedInstanceId ? 'YES' : '—',
    updated: new Date(r.updatedAt).toLocaleString(),
  }))

  const reorderByIndex = async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    const ordered = rundowns.map((r) => r.id)
    const [moved] = ordered.splice(fromIndex, 1)
    if (!moved) return
    ordered.splice(toIndex, 0, moved)
    const ok = await reorderRundowns(ordered)
    if (!ok) {
      toast.show({ level: 'err', message: 'Reorder failed' })
    }
  }

  const openSelected = () => {
    if (!selected) return
    void navigate({
      to: '/control/$rundownId',
      params: { rundownId: selected.id },
    })
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
            Rundowns
          </div>
          <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>
            Select a rundown to rename, delete, or reorder. OPEN enters playout.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Button label="REFRESH" size="sm" onClick={() => void refresh()} />
          <Button label="+ NEW RUNDOWN" size="sm" variant="accent" onClick={() => setCreateOpen(true)} />
        </div>
      </div>

      <Panel
        title="ALL RUNDOWNS"
        meta={String(rundowns.length)}
        padded={false}
        style={{ flex: 1, minHeight: 0 }}
        actions={
          <div style={{ display: 'flex', gap: 4 }}>
            <Button
              label="OPEN"
              size="sm"
              variant="accent"
              disabled={!selected}
              onClick={openSelected}
            />
            <Button
              label="RENAME"
              size="sm"
              disabled={!selected}
              title="Rename selected rundown"
              onClick={() => {
                if (!selected) return
                setRenameName(selected.name)
                setRenameOpen(true)
              }}
            />
            <Button
              size="sm"
              variant="take"
              disabled={!selected}
              title="Delete selected rundown"
              onClick={() => setDeleteOpen(true)}
              style={{ padding: '0 5px', minWidth: 20 }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden
                style={{ display: 'block' }}
              >
                <path
                  d="M3.5 4.5h9M6.5 4.5V3.25a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 .75.75V4.5m1.5 0v8.25a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V4.5m2 2.5v4.5m2-4.5v4.5"
                  stroke="currentColor"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Button>
          </div>
        }
      >
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
            selected={selectedIndex >= 0 ? selectedIndex : undefined}
            height="100%"
            reorderable
            onReorder={(from, to) => void reorderByIndex(from, to)}
            onSelect={(_, row) => setSelectedId(String(row.id))}
          />
        )}
      </Panel>

      {error ? <Badge kind="err" label={error} /> : null}

      <CreateRundownDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={createRundown}
      />

      <Dialog
        open={deleteOpen}
        title="DELETE RUNDOWN"
        message="Delete this rundown and all of its graphic instances?"
        detail={selected ? selected.name : undefined}
        confirmLabel="DELETE"
        confirmVariant="take"
        cancelLabel="CANCEL"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          if (!selected) {
            setDeleteOpen(false)
            return
          }
          void deleteRundown(selected.id).then((ok) => {
            if (ok) {
              toast.show({ level: 'ok', message: 'Rundown deleted', detail: selected.name })
              setSelectedId(null)
              setDeleteOpen(false)
            } else {
              toast.show({ level: 'err', message: 'Delete failed' })
            }
          })
        }}
      />

      <Dialog
        open={renameOpen}
        title="RENAME RUNDOWN"
        message="Enter a new name for this rundown."
        detail={selected ? selected.name : undefined}
        confirmLabel="RENAME"
        confirmVariant="accent"
        cancelLabel="CANCEL"
        onCancel={() => setRenameOpen(false)}
        onConfirm={() => {
          if (!selected) {
            setRenameOpen(false)
            return
          }
          const trimmed = renameName.trim()
          if (!trimmed) return
          void renameRundown(selected.id, trimmed).then((ok) => {
            if (ok) {
              toast.show({ level: 'ok', message: 'Rundown renamed', detail: trimmed })
              setRenameOpen(false)
            } else {
              toast.show({ level: 'err', message: 'Rename failed' })
            }
          })
        }}
        width={360}
      >
        <div style={{ marginTop: 10 }}>
          <Input label="Name" value={renameName} onChange={setRenameName} width="100%" />
        </div>
      </Dialog>
    </div>
  )
}
