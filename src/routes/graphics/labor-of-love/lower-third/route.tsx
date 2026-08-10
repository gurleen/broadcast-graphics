import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { PREVIEW_TOOLBAR_SLOT_ID } from '#/graphics/GraphicStage'
import { LaborOfLoveLowerThirdGraphic } from './-Graphic'
import { PreviewToolbarControls } from './-PreviewToolbarControls'
import { laborOfLoveLowerThirdProps, type LaborOfLoveLowerThirdProps } from './-types'

export const Route = createFileRoute('/graphics/labor-of-love/lower-third')({
  component: LaborOfLoveLowerThird,
})

const graphicsRoute = getRouteApi('/graphics')

function LaborOfLoveLowerThird() {
  const { preview } = graphicsRoute.useSearch()
  const [graphicState, setGraphicState] = useState<LaborOfLoveLowerThirdProps>(() => ({
    ...laborOfLoveLowerThirdProps,
  }))
  const [onScreen, setOnScreen] = useState(true)
  const [toolbarSlot, setToolbarSlot] = useState<HTMLElement | null>(null)

  useLayoutEffect(() => {
    if (!preview) {
      setToolbarSlot(null)
      return
    }
    setToolbarSlot(document.getElementById(PREVIEW_TOOLBAR_SLOT_ID))
  }, [preview])

  return (
    <>
      <LaborOfLoveLowerThirdGraphic props={graphicState} onScreen={onScreen} />
      {toolbarSlot &&
        createPortal(
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
              onClick={() => setOnScreen(true)}
            >
              In
            </button>
            <button
              type="button"
              className="rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600"
              onClick={() => setOnScreen(false)}
            >
              Out
            </button>
            <PreviewToolbarControls
              workerName={graphicState.workerName}
              championshipName={graphicState.championshipName}
              onChange={(patch) => setGraphicState((prev) => ({ ...prev, ...patch }))}
            />
          </div>,
          toolbarSlot,
        )}
    </>
  )
}
