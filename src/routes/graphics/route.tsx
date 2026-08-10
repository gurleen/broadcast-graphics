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
