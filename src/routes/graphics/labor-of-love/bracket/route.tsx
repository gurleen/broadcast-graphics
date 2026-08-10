import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { PREVIEW_TOOLBAR_SLOT_ID } from '#/graphics/GraphicStage'
import { LaborOfLoveBracketGraphic } from './-Graphic'
import { PreviewToolbarControls } from './-Controls'
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
  const [graphicState, setGraphicState] = useState<LaborOfLoveBracketProps>(() =>
    cloneProps(laborOfLoveBracketProps),
  )
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
      <LaborOfLoveBracketGraphic props={graphicState} onScreen={onScreen} />
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
            <button
              type="button"
              className="rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600"
              onClick={() => setGraphicState(cloneProps(laborOfLoveBracketProps))}
            >
              Reset
            </button>
            <PreviewToolbarControls
              props={graphicState}
              onReplace={(next) => setGraphicState(cloneProps(next))}
            />
          </div>,
          toolbarSlot,
        )}
    </>
  )
}
