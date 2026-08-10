import { z } from 'zod'
import { laborOfLoveBracketProps, type LaborOfLoveBracketProps } from './-types'
import type { TemplateSchema } from '#/templates/types'

const teamSchema = z.object({
  id: z.string(),
  name: z.string(),
  wrestlers: z.tuple([z.string(), z.string()]),
})

const matchWinnerSchema = z.union([z.literal('a'), z.literal('b'), z.null()])

export const laborOfLoveBracketSchema = z.object({
  eventName: z.string(),
  bracketName: z.string(),
  teams: z.tuple([
    teamSchema,
    teamSchema,
    teamSchema,
    teamSchema,
    teamSchema,
    teamSchema,
    teamSchema,
    teamSchema,
  ]),
  winners: z.object({
    qf: z.tuple([matchWinnerSchema, matchWinnerSchema, matchWinnerSchema, matchWinnerSchema]),
    sf: z.tuple([matchWinnerSchema, matchWinnerSchema]),
    final: matchWinnerSchema,
  }),
}) satisfies z.ZodType<LaborOfLoveBracketProps>

export const laborOfLoveBracketTemplateSchema: TemplateSchema<LaborOfLoveBracketProps> = {
  id: 'labor-of-love-bracket',
  name: 'Labor of Love Bracket',
  schema: laborOfLoveBracketSchema,
  defaults: laborOfLoveBracketProps,
  fields: {
    eventName: { label: 'Event', section: 'TEMPLATE DATA' },
    bracketName: { label: 'Bracket', section: 'TEMPLATE DATA' },
  },
}
