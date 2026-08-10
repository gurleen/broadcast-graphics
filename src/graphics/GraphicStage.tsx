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
          className="flex shrink-0 justify-center gap-3 border-t border-slate-700/80 bg-slate-900/95 p-4 backdrop-blur-sm"
        />
      ) : null}
    </div>
  )
}
