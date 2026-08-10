import { useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { PreviewToolbarLayout } from '#/graphics/preview/PreviewToolbarLayout'
import { PREVIEW_TOOLBAR_SLOT_ID } from '#/graphics/GraphicStage'
import { useControlledGraphic } from '#/control/client'
import { BasketballScorebugGraphic } from './-Graphic'
import { PreviewToolbarControls } from './-PreviewToolbarControls'
import { basketballScorebugTemplateSchema } from './-schema'
import {
  basketballScorebugDefaultProps,
  type BasketballScorebugProps,
} from './-types'

export const Route = createFileRoute('/graphics/drexel/basketball-scorebug')({
  component: BasketballScorebugRoute,
})

const graphicsRoute = getRouteApi('/graphics')

function clockToSeconds(clock: string): number {
  const [minutes, seconds] = clock.split(':').map((part) => Number.parseInt(part, 10))
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return 0
  return Math.max(0, minutes * 60 + seconds)
}

function secondsToClock(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds)
  const minutes = Math.floor(clamped / 60)
  const seconds = clamped % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function numericScore(score: number | string): number {
  const value = typeof score === 'number' ? score : Number.parseInt(score, 10)
  return Number.isFinite(value) ? value : 0
}

function BasketballScorebugRoute() {
  const { preview } = graphicsRoute.useSearch()
  const { props, onScreen, setProps, setOnScreen } = useControlledGraphic(
    basketballScorebugTemplateSchema,
  )
  const [clockRunning, setClockRunning] = useState(false)
  const [toolbarSlot, setToolbarSlot] = useState<HTMLElement | null>(null)

  useLayoutEffect(() => {
    if (!preview) {
      setToolbarSlot(null)
      return
    }
    setToolbarSlot(document.getElementById(PREVIEW_TOOLBAR_SLOT_ID))
  }, [preview])

  // Local clock tick only — server-authoritative clocks are a follow-up.
  useEffect(() => {
    if (!clockRunning) return

    const tick = window.setInterval(() => {
      setProps((prev) => {
        const remaining = clockToSeconds(prev.clock)
        if (remaining <= 0) {
          setClockRunning(false)
          return prev
        }

        const nextClock = secondsToClock(remaining - 1)
        const shotRemaining = numericScore(prev.shotClock)
        const nextShot = shotRemaining > 0 ? shotRemaining - 1 : shotRemaining

        return {
          ...prev,
          clock: nextClock,
          shotClock: nextShot,
        }
      })
    }, 1000)

    return () => window.clearInterval(tick)
  }, [clockRunning, setProps])

  return (
    <>
      <BasketballScorebugGraphic props={props} onScreen={onScreen} />
      {toolbarSlot &&
        createPortal(
          <PreviewToolbarLayout onIn={() => setOnScreen(true)} onOut={() => setOnScreen(false)}>
            <PreviewToolbarControls
              state={props}
              clockRunning={clockRunning}
              onClockRunningChange={setClockRunning}
              onStateChange={(patch) => {
                if (typeof patch === 'function') {
                  setProps(patch)
                } else {
                  setProps((prev) => ({ ...prev, ...patch }))
                }
              }}
            />
          </PreviewToolbarLayout>,
          toolbarSlot,
        )}
    </>
  )
}

export type { BasketballScorebugProps }
export { basketballScorebugDefaultProps }
