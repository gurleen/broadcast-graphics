import { createFileRoute } from '@tanstack/react-router'
import { GraphicCanvas } from '#/graphics/GraphicCanvas'
import { Scene } from './-Scene'

export const Route = createFileRoute('/graphics/example')({
  component: ExampleGraphic,
})

function ExampleGraphic() {
  return (
    <GraphicCanvas>
      <Scene />
    </GraphicCanvas>
  )
}
