import { useLayoutEffect, useState } from 'react'
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

function BasketballScorebugRoute() {
  const { preview } = graphicsRoute.useSearch()
  const { props, onScreen, setProps, setOnScreen } = useControlledGraphic(
    basketballScorebugTemplateSchema,
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
      <BasketballScorebugGraphic props={props} onScreen={onScreen} />
      {toolbarSlot &&
        createPortal(
          <PreviewToolbarLayout onIn={() => setOnScreen(true)} onOut={() => setOnScreen(false)}>
            <PreviewToolbarControls
              state={props}
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
