import { useEffect, useRef, useState } from 'react'
import { GRAPHIC_HEIGHT, GRAPHIC_WIDTH } from './constants'

/** Portal target for preview-only controls; lives below the scaled frame. */
export const PREVIEW_TOOLBAR_SLOT_ID = 'graphic-preview-toolbar'

type GraphicStageProps = {
  children: React.ReactNode
  preview?: boolean
  scaleOverride?: number
}

function fitScale(viewportWidth: number, viewportHeight: number) {
  return Math.min(viewportWidth / GRAPHIC_WIDTH, viewportHeight / GRAPHIC_HEIGHT)
}

export function GraphicStage({
  children,
  preview = false,
  scaleOverride,
}: GraphicStageProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [stageSize, setStageSize] = useState({ width: GRAPHIC_WIDTH, height: GRAPHIC_HEIGHT })

  // Non-preview (OBS / monitor embeds): keep the document transparent so alpha composites.
  useEffect(() => {
    if (preview) return
    const html = document.documentElement
    const body = document.body
    const prevHtml = html.style.background
    const prevBody = body.style.background
    html.style.background = 'transparent'
    body.style.background = 'transparent'
    return () => {
      html.style.background = prevHtml
      body.style.background = prevBody
    }
  }, [preview])

  useEffect(() => {
    const el = stageRef.current
    if (!el) return

    const update = () => {
      const { width, height } = el.getBoundingClientRect()
      setStageSize({ width, height })
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [preview])

  const fittedScale = fitScale(stageSize.width, stageSize.height)
  const displayScale =
    scaleOverride != null && Number.isFinite(scaleOverride) ? scaleOverride : fittedScale

  return (
    <div className="fixed inset-0 flex flex-col">
      <div
        ref={stageRef}
        className="flex min-h-0 flex-1 items-center justify-center"
      >
        <div
          style={{
            width: GRAPHIC_WIDTH * displayScale,
            height: GRAPHIC_HEIGHT * displayScale,
            flexShrink: 0,
          }}
        >
          <div
            className={preview ? 'checkerboard' : undefined}
            style={{
              width: GRAPHIC_WIDTH,
              height: GRAPHIC_HEIGHT,
              transform: `scale(${displayScale})`,
              transformOrigin: 'top left',
              position: 'relative',
              ...(preview
                ? { outline: '1px solid rgba(15, 23, 42, 0.55)' }
                : {}),
            }}
          >
            {children}
          </div>
        </div>
      </div>
      {preview ? (
        <div
          id={PREVIEW_TOOLBAR_SLOT_ID}
          style={{
            display: 'flex',
            flexShrink: 0,
            justifyContent: 'center',
            gap: 12,
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-1)',
            padding: 16,
          }}
        />
      ) : null}
    </div>
  )
}
