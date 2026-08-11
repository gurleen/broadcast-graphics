import { useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Badge, DataGrid, Panel } from '@gurleen-ui/core'
import type { DataGridRow } from '@gurleen-ui/core'
import { Tally } from '@gurleen-ui/broadcast'
import { useRundownController } from '#/control/client'
import { aggregatePhase } from '#/control/model'
import type { PlaybackPhase } from '#/control/model'

export const Route = createFileRoute('/control/$rundownId/renderers')({
  ssr: false,
  component: RenderersPage,
})

function phaseTally(phase: PlaybackPhase): 'off' | 'pgm' | 'pvw' {
  if (phase === 'onscreen' || phase === 'entering') return 'pgm'
  if (phase === 'exiting') return 'pvw'
  return 'off'
}

function formatSeen(at: number): string {
  return new Date(at).toLocaleTimeString('en-GB', { hour12: false })
}

function RenderersPage() {
  const { rundownId } = Route.useParams()
  const { instances, renderers, status } = useRundownController(rundownId)

  const byInstance = useMemo(() => {
    const map = new Map<string, typeof renderers>()
    for (const r of renderers) {
      const key = r.instanceId ?? '__unbound__'
      const list = map.get(key) ?? []
      list.push(r)
      map.set(key, list)
    }
    return map
  }, [renderers])

  const instanceRows: DataGridRow[] = instances.map((inst) => {
    const attached = byInstance.get(inst.id) ?? []
    const phase = aggregatePhase(attached)
    return {
      id: inst.id,
      label: inst.label,
      template: inst.templateId,
      sessions: String(attached.length),
      phase,
      intent: inst.playout.onScreen ? 'IN' : 'OUT',
      _state: inst.playout.onScreen ? 'onair' : inst.playout.cued ? 'cued' : undefined,
    }
  })

  const sessionRows: DataGridRow[] = renderers.map((r) => ({
    sessionId: r.sessionId.slice(0, 8),
    instance: r.instanceId
      ? (instances.find((i) => i.id === r.instanceId)?.label ?? r.instanceId.slice(0, 8))
      : '—',
    template: r.templateId ?? '—',
    label: r.label ?? '—',
    phase: r.phase,
    rev: String(r.ackedRevision),
    seen: formatSeen(r.lastSeenAt),
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Badge kind={status === 'open' ? 'info' : 'warn'} label={`WS ${status.toUpperCase()}`} dot />
        <Badge kind="neutral" label={`${renderers.length} SESSIONS`} />
        <Badge kind="neutral" label={`${instances.length} INSTANCES`} />
      </div>

      <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
        <Panel title="INSTANCE PHASES" meta="aggregate" padded={false} style={{ flex: 1, minWidth: 0 }}>
          {instanceRows.length === 0 ? (
            <div style={{ padding: 16, fontSize: 11, color: 'var(--fg-3)' }}>No instances in this rundown.</div>
          ) : (
            <DataGrid
              columns={[
                { key: 'label', label: 'Instance' },
                { key: 'template', label: 'Template', width: '180px', dim: true },
                { key: 'intent', label: 'Intent', width: '56px', align: 'center' },
                { key: 'phase', label: 'Phase', width: '90px' },
                { key: 'sessions', label: 'Rdrs', width: '48px', align: 'right', dim: true },
              ]}
              rows={instanceRows}
              height="100%"
            />
          )}
        </Panel>

        <Panel title="AGGREGATE TALLY" style={{ width: 220, flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {instances.length === 0 ? (
              <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>No instances.</span>
            ) : (
              instances.map((inst) => {
                const attached = byInstance.get(inst.id) ?? []
                const phase = aggregatePhase(attached)
                return (
                  <Tally
                    key={inst.id}
                    state={phaseTally(phase)}
                    sublabel={phase.toUpperCase()}
                    label={inst.label}
                    size="sm"
                    style={{ width: '100%' }}
                  />
                )
              })
            )}
          </div>
        </Panel>
      </div>

      <Panel title="RENDERER SESSIONS" meta={String(renderers.length)} padded={false} style={{ flex: 1, minHeight: 0 }}>
        {sessionRows.length === 0 ? (
          <div style={{ padding: 16, fontSize: 11, color: 'var(--fg-3)' }}>
            No renderer sessions connected. Open a graphic with ?rundown=&instance= or /render/{rundownId}.
          </div>
        ) : (
          <DataGrid
            columns={[
              { key: 'sessionId', label: 'Session', width: '80px', dim: true },
              { key: 'instance', label: 'Instance' },
              { key: 'template', label: 'Template', width: '180px', dim: true },
              { key: 'label', label: 'Label', width: '100px', dim: true },
              { key: 'phase', label: 'Phase', width: '90px' },
              { key: 'rev', label: 'Rev', width: '48px', align: 'right', dim: true },
              { key: 'seen', label: 'Last seen', width: '90px', dim: true },
            ]}
            rows={sessionRows}
            height="100%"
          />
        )}
      </Panel>
    </div>
  )
}
