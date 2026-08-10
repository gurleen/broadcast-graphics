import { z } from 'zod'
import {
  basketballScorebugDefaultProps,
  type BasketballScorebugProps,
} from './-types'
import type { TemplateSchema } from '#/templates/types'

export type { BasketballScorebugProps, BasketballScorebugTeam } from './-types'
export { basketballScorebugDefaultProps } from './-types'

const teamSchema = z.object({
  teamCode: z.string(),
  primaryColor: z.string(),
  score: z.union([z.number(), z.string()]),
})

export const basketballScorebugSchema = z.object({
  home: teamSchema,
  away: teamSchema,
  clock: z.string(),
  period: z.string(),
  shotClock: z.union([z.number(), z.string()]),
  shotClockColor: z.string().optional(),
}) satisfies z.ZodType<BasketballScorebugProps>

export const basketballScorebugTemplateSchema: TemplateSchema<BasketballScorebugProps> = {
  id: 'drexel-basketball-scorebug',
  name: 'Drexel Basketball Scorebug',
  route: '/graphics/drexel/basketball-scorebug',
  schema: basketballScorebugSchema,
  defaults: basketballScorebugDefaultProps,
  fields: {
    clock: { label: 'Clock', section: 'GAME' },
    period: { label: 'Period', section: 'GAME', type: 'select', options: ['1ST', '2ND', 'HALF', '3RD', '4TH', 'OT', '2OT'] },
    shotClock: { label: 'Shot Clock', section: 'GAME', type: 'number' },
  },
  transition: { inMs: 700, outMs: 350 },
}
