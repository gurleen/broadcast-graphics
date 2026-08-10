import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { PreviewToolbarLayout } from '#/graphics/preview/PreviewToolbarLayout'
import { PREVIEW_TOOLBAR_SLOT_ID } from '#/graphics/GraphicStage'
import { useControlledGraphic } from '#/control/client'
import { LaborOfLoveBracketGraphic } from './-Graphic'
import { PreviewToolbarControls } from './-Controls'
import { laborOfLoveBracketTemplateSchema } from './-schema'
import { laborOfLoveBracketProps, type LaborOfLoveBracketProps } from './-types'

export const Route = createFileRoute('/graphics/labor-of-love/bracket')({
  component: LaborOfLoveBracket,
})

const graphicsRoute = getRouteApi('/graphics')

function cloneProps(props: LaborOfLoveBracketProps): LaborOfLoveBracketProps {
  return {
    ...props,
    teams: [...props.teams] as LaborOfLoveBracketProps['teams'],
    winners: {
      qf: [...props.winners.qf] as LaborOfLoveBracketProps['winners']['qf'],
      sf: [...props.winners.sf] as LaborOfLoveBracketProps['winners']['sf'],
      final: props.winners.final,
    },
  }
}

function LaborOfLoveBracket() {
  const { preview } = graphicsRoute.useSearch()
  const { props, onScreen, setProps, setOnScreen } = useControlledGraphic(
    laborOfLoveBracketTemplateSchema,
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
      <LaborOfLoveBracketGraphic props={props} onScreen={onScreen} />
      {toolbarSlot &&
        createPortal(
          <PreviewToolbarLayout
            onIn={() => setOnScreen(true)}
            onOut={() => setOnScreen(false)}
            onReset={() => setProps(cloneProps(laborOfLoveBracketProps))}
          >
            <PreviewToolbarControls
              props={props}
              onReplace={(next) => setProps(cloneProps(next))}
            />
          </PreviewToolbarLayout>,
          toolbarSlot,
        )}
    </>
  )
}
