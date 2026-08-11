import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  Badge,
  Button,
  DataGrid,
  Dialog,
  LogConsole,
  Panel,
  useToast,
} from '@gurleen-ui/core'
import type { DataGridRow, LogLine as UiLogLine } from '@gurleen-ui/core'
import { Tally } from '@gurleen-ui/broadcast'
import { useRundownController, useTemplateCatalog } from '#/control/client'
import type { GraphicInstance } from '#/control/model'
import { AddInstanceDialog } from './-AddInstanceDialog'
import { MonitorWell } from './-MonitorWell'
import { PropertyPanel } from './-PropertyPanel'

export const Route = createFileRoute('/control/$rundownId/')({
  ssr: false,
  component: PlayoutPage,
})

function formatLogTime(at: number): string {
  return new Date(at).toLocaleTimeString('en-GB', { hour12: false })
}

function mapLogLevel(kind: string): UiLogLine['level'] {
  switch (kind) {
    case 'ok':
      return 'ok'
    case 'err':
      return 'err'
    case 'cmd':
      return 'cmd'
    default:
      return 'info'
  }
}

function PlayoutPage() {
  const { rundownId } = Route.useParams()
  const toast = useToast()
  const {
    status,
    rundown,
    instances,
    log,
    cue,
    take,
    clearAll,
    patchProps,
    replaceProps,
    addInstance,
    removeInstance,
    reorder,
  } = useRundownController(rundownId)
  const { templates } = useTemplateCatalog()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)

  // Keep selection valid as instances change.
  const selected = useMemo(() => {
    if (selectedId) {
      const found = instances.find((i) => i.id === selectedId)
      if (found) return found
    }
    return instances.find((i) => i.playout.cued) ?? instances[0] ?? null
  }, [instances, selectedId])

  const cued = instances.find((i) => i.playout.cued) ?? null
  const onAir = instances.filter((i) => i.playout.onScreen)
  const primaryOnAir = onAir[0] ?? null
  const onAirKey = onAir.map((i) => i.id).join(',')

  const templateById = useMemo(() => new Map(templates.map((t) => [t.id, t])), [templates])

  // Keep PGM iframe mounted across the OUT animation. State must stay true when
  // onAir drops to [] — flipping it false even for one commit remounts the iframe
  // and cuts the animation.
  const [showPgmFeed, setShowPgmFeed] = useState(false)
  const [pgmHoldLabel, setPgmHoldLabel] = useState<string | null>(null)
  const lastOnAirRef = useRef<GraphicInstance[]>([])
  const onAirRef = useRef(onAir)
  onAirRef.current = onAir

  useLayoutEffect(() => {
    const current = onAirRef.current
    if (current.length > 0) {
      lastOnAirRef.current = current
      setShowPgmFeed(true)
      setPgmHoldLabel(null)
      return
    }

    if (!showPgmFeed) return

    const prev = lastOnAirRef.current
    const holdMs = Math.max(
      400,
      ...prev.map((inst) => templateById.get(inst.templateId)?.transition?.outMs ?? 400),
    )
    setPgmHoldLabel(prev[0]?.label ?? null)

    const timer = window.setTimeout(() => {
      lastOnAirRef.current = []
      setShowPgmFeed(false)
      setPgmHoldLabel(null)
    }, holdMs)
    return () => window.clearTimeout(timer)
  }, [onAirKey, showPgmFeed, templateById])

  const pgmLabel = primaryOnAir?.label ?? (showPgmFeed ? pgmHoldLabel : null)

  const rows: DataGridRow[] = instances.map((inst, index) => ({
    id: inst.id,
    index: String(index + 1).padStart(3, '0'),
    label: inst.label,
    template: templateById.get(inst.templateId)?.name ?? inst.templateId,
    phase: inst.playout.onScreen ? 'IN' : inst.playout.cued ? 'CUED' : 'OUT',
    _state: inst.playout.onScreen ? 'onair' : inst.playout.cued ? 'cued' : undefined,
    _instance: inst,
  }))

  const selectedIndex = selected ? instances.findIndex((i) => i.id === selected.id) : -1

  // No preview/scale params — GraphicStage auto-fits the iframe viewport (16:9).
  const pvwSrc = (() => {
    if (!cued) return null
    const route = templateById.get(cued.templateId)?.route
    if (!route) return null
    const params = new URLSearchParams({
      rundown: rundownId,
      instance: cued.id,
      forceOnScreen: '1',
    })
    return `${route}?${params.toString()}`
  })()

  const pgmSrc = `/render/${rundownId}`

  const uiLog: UiLogLine[] = log.map((line) => ({
    time: formatLogTime(line.at),
    text: line.message,
    level: mapLogLevel(line.kind),
  }))

  const run = async (
    label: string,
    fn: () => Promise<{ ok: boolean; error?: { message: string } }>,
  ) => {
    const result = await fn()
    if (!result.ok) {
      toast.show({
        level: 'err',
        message: label,
        detail: result.error?.message ?? 'Command failed',
      })
    }
    return result.ok
  }

  const moveSelected = async (dir: -1 | 1) => {
    if (!selected || selectedIndex < 0) return
    const nextIndex = selectedIndex + dir
    if (nextIndex < 0 || nextIndex >= instances.length) return
    const ordered = instances.map((i) => i.id)
    const [item] = ordered.splice(selectedIndex, 1)
    ordered.splice(nextIndex, 0, item!)
    await run('Reorder', () => reorder(ordered))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
        <Panel
          title="RUNDOWN"
          meta={rundown?.name ?? rundownId}
          padded={false}
          style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', minHeight: 0 }}
          bodyStyle={{ display: 'flex', flexDirection: 'column', minHeight: 0, padding: 0 }}
          actions={
            <div style={{ display: 'flex', gap: 4 }}>
              <Button label="+" size="sm" variant="accent" onClick={() => setAddOpen(true)} />
              <Button
                size="sm"
                disabled={!selected || status !== 'open'}
                title="Remove selected instance"
                onClick={() => setRemoveOpen(true)}
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
              <Button
                label="↑"
                size="sm"
                disabled={selectedIndex <= 0}
                onClick={() => void moveSelected(-1)}
              />
              <Button
                label="↓"
                size="sm"
                disabled={selectedIndex < 0 || selectedIndex >= instances.length - 1}
                onClick={() => void moveSelected(1)}
              />
            </div>
          }
        >
          <div style={{ flex: 1, minHeight: 0 }}>
            <DataGrid
              columns={[
                { key: 'index', label: '#', width: '36px', dim: true },
                { key: 'label', label: 'Name' },
                { key: 'template', label: 'Type', width: '110px', dim: true },
                { key: 'phase', label: 'State', width: '48px', align: 'right', dim: true },
              ]}
              rows={rows}
              selected={selectedIndex >= 0 ? selectedIndex : undefined}
              height="100%"
              onSelect={(_, row) => {
                const inst = row._instance as GraphicInstance
                setSelectedId(inst.id)
                void run('Cue', () => cue(inst.id))
              }}
            />
          </div>
          <div
            style={{
              flexShrink: 0,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 8,
              padding: 8,
              borderTop: '1px solid var(--line-1)',
              background: 'var(--grad-panel)',
            }}
          >
            {(() => {
              const programLive = onAir.length > 0
              return (
                <Button
                  label={programLive ? '■ STOP' : '▶ PLAY'}
                  size="xl"
                  variant={programLive ? 'take' : 'default'}
                  active={programLive}
                  disabled={status !== 'open' || (!programLive && !cued)}
                  title={
                    programLive
                      ? 'Take program graphics off air'
                      : 'Take cued graphic to program'
                  }
                  onClick={() => {
                    if (programLive) {
                      void run('Stop', () => clearAll())
                    } else if (cued) {
                      void run('Play', () => take())
                    }
                  }}
                  style={
                    programLive
                      ? {
                          color: 'var(--tally-pgm)',
                          textShadow: '0 0 8px #f23a3088',
                        }
                      : {
                          color: 'var(--tally-pvw)',
                          textShadow: 'var(--led-glow-green)',
                          background: 'linear-gradient(#0a2313,#06180c)',
                          borderColor: 'var(--tally-pvw-dim)',
                        }
                  }
                />
              )
            })()}
            <Button
              label="BLANK"
              size="xl"
              variant="armed"
              active={onAir.length > 0}
              disabled={status !== 'open' || onAir.length === 0}
              title="Clear all graphics from program"
              onClick={() => void run('Blank', () => clearAll())}
            />
          </div>
        </Panel>

        <Panel title="PREVIEW / PROGRAM" style={{ width: 360, flexShrink: 0, minWidth: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <Tally
                state={cued ? 'pvw' : 'off'}
                sublabel="PVW"
                label={cued ? cued.label : 'EMPTY'}
                style={{ marginBottom: 6, width: '100%' }}
              />
              <MonitorWell
                tally={cued ? 'pvw' : 'off'}
                caption={cued ? cued.label : 'NO SOURCE'}
                src={pvwSrc}
              />
            </div>
            <div style={{ minWidth: 0 }}>
              <Tally
                state={showPgmFeed ? 'pgm' : 'off'}
                sublabel="PGM"
                label={pgmLabel ?? 'EMPTY'}
                style={{ marginBottom: 6, width: '100%' }}
              />
              <MonitorWell
                tally={showPgmFeed ? 'pgm' : 'off'}
                caption={pgmLabel ?? 'NO SOURCE'}
                src={showPgmFeed ? pgmSrc : null}
                transparent
              />
            </div>
          </div>
        </Panel>

        <Panel title="TEMPLATE PROPERTIES" style={{ flex: 1, minWidth: 280 }} bodyStyle={{ overflow: 'auto', minWidth: 0 }}>
          <PropertyPanel
            instance={selected}
            template={selected ? templateById.get(selected.templateId) : undefined}
            onPatch={(patch) => {
              if (!selected) return
              void patchProps(selected.id, patch).then((result) => {
                if (!result.ok) {
                  toast.show({
                    level: 'err',
                    message: 'Patch props',
                    detail: result.error?.message ?? 'Command failed',
                  })
                }
              })
            }}
            onReplace={(props) => {
              if (!selected) return
              void replaceProps(selected.id, props).then((result) => {
                if (!result.ok) {
                  toast.show({
                    level: 'err',
                    message: 'Replace props',
                    detail: result.error?.message ?? 'Command failed',
                  })
                }
              })
            }}
          />
        </Panel>
      </div>

      <Panel title="EVENT LOG" padded={false} style={{ flexShrink: 0 }}>
        <LogConsole lines={uiLog} height={88} />
      </Panel>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Badge kind={status === 'open' ? 'info' : status === 'closed' ? 'err' : 'warn'} label={`WS ${status.toUpperCase()}`} dot />
        {onAir.length > 0 ? <Badge kind="pgm" label={`${onAir.length} ON AIR`} /> : <Badge kind="neutral" label="IDLE" />}
        {cued ? <Badge kind="pvw" label={`CUED ${cued.label}`} /> : null}
      </div>

      <AddInstanceDialog
        open={addOpen}
        templates={templates}
        onClose={() => setAddOpen(false)}
        onAdd={async (input) => {
          const ok = await run('Add instance', () => addInstance(input))
          if (ok) toast.show({ level: 'ok', message: 'Instance added', detail: input.templateId })
          return ok
        }}
      />

      <Dialog
        open={removeOpen}
        title="REMOVE INSTANCE"
        message="Remove this graphic from the rundown?"
        detail={selected ? selected.label : undefined}
        confirmLabel="REMOVE"
        confirmVariant="take"
        cancelLabel="CANCEL"
        onCancel={() => setRemoveOpen(false)}
        onConfirm={() => {
          if (!selected) {
            setRemoveOpen(false)
            return
          }
          void run('Remove', () => removeInstance(selected.id)).then((ok) => {
            if (ok) {
              setSelectedId(null)
              setRemoveOpen(false)
            }
          })
        }}
      />
    </div>
  )
}
