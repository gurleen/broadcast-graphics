import { z } from 'zod'
import type { TemplateSchema } from './types'
import { laborOfLoveLowerThirdTemplateSchema } from '#/routes/graphics/labor-of-love/lower-third/-schema'
import { laborOfLoveBracketTemplateSchema } from '#/routes/graphics/labor-of-love/bracket/-schema'
import { basketballScorebugTemplateSchema } from '#/routes/graphics/drexel/basketball-scorebug/-schema'

/** Server-safe template registry — zod schemas and metadata only, no React. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TEMPLATES: TemplateSchema<any>[] = [
  laborOfLoveLowerThirdTemplateSchema,
  laborOfLoveBracketTemplateSchema,
  basketballScorebugTemplateSchema,
]

const byId = new Map(TEMPLATES.map((t) => [t.id, t]))

export function listTemplates(): TemplateSchema<Record<string, unknown>>[] {
  return TEMPLATES as TemplateSchema<Record<string, unknown>>[]
}

export function getTemplateSchema(
  id: string,
): TemplateSchema<Record<string, unknown>> | undefined {
  return byId.get(id) as TemplateSchema<Record<string, unknown>> | undefined
}

export function getTemplateIds(): string[] {
  return TEMPLATES.map((t) => t.id)
}

export type TemplatePublicMeta = {
  id: string
  name: string
  route: string
  defaults: Record<string, unknown>
  fields: TemplateSchema<Record<string, unknown>>['fields']
  transition?: TemplateSchema<Record<string, unknown>>['transition']
  jsonSchema: Record<string, unknown>
}

export function listTemplatesPublic(): TemplatePublicMeta[] {
  return TEMPLATES.map((t) => ({
    id: t.id,
    name: t.name,
    route: t.route,
    defaults: t.defaults as Record<string, unknown>,
    fields: t.fields,
    transition: t.transition,
    jsonSchema: z.toJSONSchema(t.schema) as Record<string, unknown>,
  }))
}
