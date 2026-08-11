import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Switch } from '@hydra-tv/ui'
import { GRAPHIC_HEIGHT, GRAPHIC_WIDTH } from '#/graphics/constants'
import { useTemplateComponents } from '#/packages/hooks'
import type { PackagePublicMeta } from '#/templates/schemas'

type TemplatePreviewProps = {
  templateId: string
  defaults: Record<string, unknown>
  packages: PackagePublicMeta[]
}

const CHECKER: CSSProperties = {
  backgroundColor: '#0a0d10',
  backgroundImage: [
    'linear-gradient(45deg, #1a2028 25%, transparent 25%)',
    'linear-gradient(-45deg, #1a2028 25%, transparent 25%)',
    'linear-gradient(45deg, transparent 75%, #1a2028 75%)',
    'linear-gradient(-45deg, transparent 75%, #1a2028 75%)',
  ].join(', '),
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
}

export function TemplatePreview({ templateId, defaults, packages }: TemplatePreviewProps) {
  const wellRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [previewOn, setPreviewOn] = useState(true)
  const { byId, loading } = useTemplateComponents([templateId], packages)
  const def = byId.get(templateId)
  const Render = def?.Render

  useEffect(() => {
    setPreviewOn(true)
  }, [templateId])

  useEffect(() => {
    const el = wellRef.current
    if (!el) return
    const update = () => setWidth(el.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const scale = width > 0 ? width / GRAPHIC_WIDTH : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        ref={wellRef}
        style={{
          width: '100%',
          aspectRatio: '16/9',
          ...CHECKER,
          border: '1px solid var(--line-1)',
          borderRadius: 'var(--radius-1)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {loading && !Render ? (
          <Caption>LOADING…</Caption>
        ) : !Render ? (
          <Caption>NO RENDER</Caption>
        ) : scale > 0 ? (
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
            <Render props={defaults} onScreen={previewOn} />
          </div>
        ) : null}
      </div>
      <Switch labels={['OUT', 'IN']} checked={previewOn} onChange={setPreviewOn} />
    </div>
  )
}

function Caption({ children }: { children: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-mono)',
        color: 'var(--fg-3)',
        fontSize: 12,
        letterSpacing: '0.1em',
      }}
    >
      {children}
    </div>
  )
}
