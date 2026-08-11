import { createFileRoute, Outlet } from '@tanstack/react-router'
import { GraphicStage } from '#/graphics/GraphicStage'

export const Route = createFileRoute('/graphics')({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    preview: search.preview === true || search.preview === '1',
    scale:
      search.scale != null && search.scale !== ''
        ? Number(search.scale)
        : undefined,
    rundown: typeof search.rundown === 'string' && search.rundown ? search.rundown : undefined,
    instance: typeof search.instance === 'string' && search.instance ? search.instance : undefined,
    /** Force the IN animation (PVW monitor); ignores server playout intent for display. */
    forceOnScreen:
      search.forceOnScreen === true ||
      search.forceOnScreen === '1' ||
      search.forceOnScreen === 1,
  }),
  component: GraphicsLayout,
})

function GraphicsLayout() {
  const { preview, scale } = Route.useSearch()

  return (
    <GraphicStage preview={preview} scaleOverride={scale}>
      <Outlet />
    </GraphicStage>
  )
}
