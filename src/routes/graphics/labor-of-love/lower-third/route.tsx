import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { PreviewToolbarLayout } from '#/graphics/preview/PreviewToolbarLayout'
import { PREVIEW_TOOLBAR_SLOT_ID } from '#/graphics/GraphicStage'
import { useControlledGraphic } from '#/control/client'
import { LaborOfLoveLowerThirdGraphic } from './-Graphic'
import { PreviewToolbarControls } from './-PreviewToolbarControls'
import { laborOfLoveLowerThirdTemplateSchema } from './-schema'

export const Route = createFileRoute('/graphics/labor-of-love/lower-third')({
  component: LaborOfLoveLowerThird,
})

const graphicsRoute = getRouteApi('/graphics')

function LaborOfLoveLowerThird() {
  const { preview } = graphicsRoute.useSearch()
  const { props, onScreen, patchProps, setOnScreen } = useControlledGraphic(
    laborOfLoveLowerThirdTemplateSchema,
  )
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
      <LaborOfLoveLowerThirdGraphic props={props} onScreen={onScreen} />
      {toolbarSlot &&
        createPortal(
          <PreviewToolbarLayout onIn={() => setOnScreen(true)} onOut={() => setOnScreen(false)}>
            <PreviewToolbarControls
              workerName={props.workerName}
              championshipName={props.championshipName}
              onChange={(patch) => patchProps(patch)}
            />
          </PreviewToolbarLayout>,
          toolbarSlot,
        )}
    </>
  )
}
