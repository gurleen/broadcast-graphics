import { GraphicStage } from '#/graphics/GraphicStage'
import { useRundownController, useTemplateCatalog } from '#/control/client'
import { useTemplateComponents } from '#/packages/hooks'
import { installClientRuntime } from '#/packages/runtime'
import { useEffect } from 'react'

export type RenderRundownViewProps = {
  rundownId: string | null
  preview?: boolean
  scale?: number
  /** Preview-only empty-state copy when no active rundown is set. */
  emptyLabel?: string
}

export function RenderRundownView({
  rundownId,
  preview = false,
  scale,
  emptyLabel = 'NO ACTIVE RUNDOWN',
}: RenderRundownViewProps) {
  const { instances, status, panicSeq } = useRundownController(rundownId)
  const { packages } = useTemplateCatalog()
  const templateIds = instances.map((i) => i.templateId)
  const { byId, loading } = useTemplateComponents(templateIds, packages)
  const suppressLayers = panicSeq > 0 && !instances.some((i) => i.playout.onScreen)

  useEffect(() => {
    installClientRuntime()
  }, [])

  return (
    <GraphicStage preview={preview} scaleOverride={scale}>
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      >
        {!rundownId && preview ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              color: 'rgba(255,255,255,0.7)',
              fontFamily: 'monospace',
              fontSize: 14,
              zIndex: 9999,
              pointerEvents: 'none',
            }}
          >
            {emptyLabel}
          </div>
        ) : null}
        {rundownId && status !== 'open' && preview ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              color: 'rgba(255,255,255,0.7)',
              fontFamily: 'monospace',
              fontSize: 14,
              zIndex: 9999,
              pointerEvents: 'none',
            }}
          >
            LINK {status.toUpperCase()}
          </div>
        ) : null}
        {loading && preview ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              color: 'rgba(255,255,255,0.5)',
              fontFamily: 'monospace',
              fontSize: 12,
              zIndex: 9998,
              pointerEvents: 'none',
            }}
          >
            LOADING PACKAGES…
          </div>
        ) : null}
        {suppressLayers || !rundownId
          ? null
          : instances.map((instance) => {
              const def = byId.get(instance.templateId)
              if (!def) return null
              const Render = def.Render
              return (
                <div
                  key={instance.id}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: instance.layer * 100 + instance.sortOrder,
                    pointerEvents: 'none',
                  }}
                >
                  <Render props={instance.props} onScreen={instance.playout.onScreen} />
                </div>
              )
            })}
      </div>
    </GraphicStage>
  )
}
