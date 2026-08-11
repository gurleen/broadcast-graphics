import type { ComponentType } from 'react'
import type { TemplateDefinition, TemplateRenderProps } from './types'
import { laborOfLoveLowerThirdTemplateSchema } from '#/routes/graphics/labor-of-love/lower-third/-schema'
import { LaborOfLoveLowerThirdGraphic } from '#/routes/graphics/labor-of-love/lower-third/-Graphic'
import { laborOfLoveBracketTemplateSchema } from '#/routes/graphics/labor-of-love/bracket/-schema'
import { LaborOfLoveBracketGraphic } from '#/routes/graphics/labor-of-love/bracket/-Graphic'
import { LaborOfLoveBracketControls } from '#/routes/graphics/labor-of-love/bracket/-Controls'
import { basketballScorebugTemplateSchema } from '#/routes/graphics/drexel/basketball-scorebug/-schema'
import { BasketballScorebugGraphic } from '#/routes/graphics/drexel/basketball-scorebug/-Graphic'
import { BasketballScorebugControls } from '#/routes/graphics/drexel/basketball-scorebug/-Controls'

/** Built-in templates compiled into the host bundle. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TEMPLATES: TemplateDefinition<any>[] = [
  {
    ...laborOfLoveLowerThirdTemplateSchema,
    Render: LaborOfLoveLowerThirdGraphic,
  },
  {
    ...laborOfLoveBracketTemplateSchema,
    Render: LaborOfLoveBracketGraphic,
    Controls: LaborOfLoveBracketControls,
  },
  {
    ...basketballScorebugTemplateSchema,
    Render: BasketballScorebugGraphic,
    Controls: BasketballScorebugControls,
  },
]

const byId = new Map(TEMPLATES.map((t) => [t.id, t]))

export function listTemplateDefinitions(): TemplateDefinition<Record<string, unknown>>[] {
  return TEMPLATES as TemplateDefinition<Record<string, unknown>>[]
}

export function getTemplateDefinition(
  id: string,
): TemplateDefinition<Record<string, unknown>> | undefined {
  return byId.get(id) as TemplateDefinition<Record<string, unknown>> | undefined
}

export function getStaticTemplateRender(
  id: string,
): ComponentType<TemplateRenderProps<Record<string, unknown>>> | undefined {
  return getTemplateDefinition(id)?.Render
}
