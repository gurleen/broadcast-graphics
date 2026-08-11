import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Badge, Button, DataGrid, Panel, PropertyEditor, Spinner, useToast } from '@hydra-tv/ui'
import type { DataGridRow, PropertyField } from '@hydra-tv/ui'
import { useRundownController, useTemplateCatalog } from '#/control/client'
import { AddInstanceDialog } from './-AddInstanceDialog'
import { TemplatePreview } from './-TemplatePreview'

export const Route = createFileRoute('/control/$rundownId/templates')({
  ssr: false,
  component: TemplatesPage,
})

function TemplatesPage() {
  const { rundownId } = Route.useParams()
  const toast = useToast()
  const { templates, packages, loading, error } = useTemplateCatalog()
  const { addInstance, status } = useRundownController(rundownId)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const selected = useMemo(() => {
    if (selectedId) return templates.find((t) => t.id === selectedId) ?? templates[0] ?? null
    return templates[0] ?? null
  }, [templates, selectedId])

  const selectedIndex = selected ? templates.findIndex((t) => t.id === selected.id) : -1

  const rows: DataGridRow[] = templates.map((t) => ({
    id: t.id,
    name: t.name,
    route: t.route,
    fields: String(Object.keys(t.fields ?? {}).length),
  }))

  const previewFields: PropertyField[] = useMemo(() => {
    if (!selected) return []
    const fields = selected.fields ?? {}
    return Object.entries(fields).map(([key, def]) => ({
      key,
      label: def?.label ?? key,
      type: 'readonly' as const,
      value: formatDefault(selected.defaults[key]),
    }))
  }, [selected])

  return (
    <div style={{ display: 'flex', gap: 12, height: '100%', minHeight: 0 }}>
      <Panel
        title="TEMPLATE CATALOG"
        meta={String(templates.length)}
        padded={false}
        style={{ flex: 1, minWidth: 0 }}
        actions={
          <Button
            label="ADD TO RUNDOWN"
            size="sm"
            variant="accent"
            disabled={!selected || status !== 'open'}
            onClick={() => setAddOpen(true)}
          />
        }
      >
        {loading && templates.length === 0 ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}>
            <Spinner />
          </div>
        ) : error ? (
          <div style={{ padding: 16, color: 'var(--err)', fontSize: 11 }}>{error}</div>
        ) : (
          <DataGrid
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'id', label: 'ID', width: '220px', dim: true },
              { key: 'route', label: 'Route', width: '240px', dim: true },
              { key: 'fields', label: 'Fields', width: '60px', align: 'right', dim: true },
            ]}
            rows={rows}
            selected={selectedIndex >= 0 ? selectedIndex : undefined}
            height="100%"
            onSelect={(_, row) => setSelectedId(String(row.id))}
          />
        )}
      </Panel>

      <Panel
        title="TEMPLATE DETAIL"
        style={{ width: 320, flexShrink: 0 }}
        actions={
          selected ? (
            <Badge kind="info" label={selected.transition ? `${selected.transition.inMs}/${selected.transition.outMs}ms` : 'NO TX'} />
          ) : null
        }
      >
        {selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em' }}>{selected.name}</div>
            <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>{selected.route}</div>
            {previewFields.length > 0 ? (
              <PropertyEditor sections={[{ title: 'DEFAULTS', fields: previewFields }]} />
            ) : (
              <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>No field definitions.</span>
            )}
            <Button
              label="ADD TO RUNDOWN"
              variant="accent"
              disabled={status !== 'open'}
              onClick={() => setAddOpen(true)}
            />
            <TemplatePreview
              templateId={selected.id}
              defaults={selected.defaults}
              packages={packages}
            />
          </div>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>Select a template.</span>
        )}
      </Panel>

      <AddInstanceDialog
        open={addOpen}
        templates={templates}
        initialTemplateId={selected?.id}
        onClose={() => setAddOpen(false)}
        onAdd={async (input) => {
          const result = await addInstance(input)
          if (result.ok) {
            toast.show({ level: 'ok', message: 'Instance added', detail: input.templateId })
            return true
          }
          toast.show({
            level: 'err',
            message: 'Add failed',
            detail: result.error?.message ?? 'Unknown error',
          })
          return false
        }}
      />
    </div>
  )
}

function formatDefault(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
