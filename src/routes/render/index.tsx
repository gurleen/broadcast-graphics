import { createFileRoute } from '@tanstack/react-router'
import { useActiveRundownId } from '#/control/client'
import { RenderRundownView } from './-RenderRundownView'

export const Route = createFileRoute('/render/')({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    preview: search.preview === true || search.preview === '1',
    scale:
      search.scale != null && search.scale !== ''
        ? Number(search.scale)
        : undefined,
  }),
  component: RenderDefault,
})

/** OBS-friendly composite that always follows the active (open) rundown. */
function RenderDefault() {
  const rundownId = useActiveRundownId()
  const { preview, scale } = Route.useSearch()
  return <RenderRundownView rundownId={rundownId} preview={preview} scale={scale} />
}
