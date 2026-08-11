import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Switch } from '@hydra-tv/ui'
import { GRAPHIC_HEIGHT, GRAPHIC_WIDTH } from '#/graphics/constants'
import type { GraphicInstance } from '#/control/model'
import { useTemplateComponents } from '#/packages/hooks'
import type { PackagePublicMeta } from '#/templates/schemas'

type PvwMonitorProps = {
  instance: GraphicInstance | null
  packages: PackagePublicMeta[]
  templateMissing?: boolean
}

export function PvwMonitor({ instance, packages, templateMissing = false }: PvwMonitorProps) {
  const wellRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [previewOn, setPreviewOn] = useState(true)
  const templateId = instance?.templateId
  const { byId, loading } = useTemplateComponents(templateId ? [templateId] : [], packages)
  const Render = templateId ? byId.get(templateId)?.Render : undefined

  useEffect(() => {
    setPreviewOn(true)
  }, [instance?.id])

  useEffect(() => {
    const el = wellRef.current
    if (!el) return
    const update = () => setWidth(el.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const tally = instance ? 'pvw' : 'off'
  const color = tally === 'pvw' ? 'var(--tally-pvw)' : 'var(--fg-3)'
  const scale = width > 0 ? width / GRAPHIC_WIDTH : 0

  let body: ReactNode
  if (!instance) {
    body = <Caption color={color}>NO SOURCE</Caption>
  } else if (templateMissing) {
    body = <Caption color={color}>TEMPLATE MISSING</Caption>
  } else if (loading && !Render) {
    body = <Caption color={color}>LOADING…</Caption>
  } else if (!Render) {
    body = <Caption color={color}>NO RENDER</Caption>
  } else if (scale > 0) {
    body = (
      <div
        style={{
          width: GRAPHIC_WIDTH,
          height: GRAPHIC_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          pointerEvents: 'none',
          position: 'relative',
        }}
      >
        <Render props={instance.props} onScreen={previewOn} />
      </div>
    )
  } else {
    body = null
  }

  return (
    <div
      style={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          containerType: 'size',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          ref={wellRef}
          style={{
            aspectRatio: '16/9',
            width: 'min(100%, calc(100cqh * 16 / 9))',
            background: '#030405',
            border: `1px solid ${tally === 'off' ? 'var(--line-1)' : color}`,
            borderRadius: 'var(--radius-1)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {body}
        </div>
      </div>
      <div style={{ flexShrink: 0 }}>
        <Switch
          labels={['OUT', 'IN']}
          checked={previewOn}
          onChange={setPreviewOn}
          disabled={!instance || !Render}
        />
      </div>
    </div>
  )
}

function Caption({ children, color }: { children: string; color: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-mono)',
        color,
        fontSize: 12,
        letterSpacing: '0.1em',
      }}
    >
      {children}
    </div>
  )
}
