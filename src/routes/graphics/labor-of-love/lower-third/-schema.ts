import { z } from 'zod'
import { laborOfLoveLowerThirdProps, type LaborOfLoveLowerThirdProps } from './-types'
import type { TemplateSchema } from '#/templates/types'

export type { LaborOfLoveLowerThirdProps } from './-types'
export { laborOfLoveLowerThirdProps } from './-types'

export const laborOfLoveLowerThirdSchema = z.object({
  workerName: z.string(),
  championshipName: z.string(),
  workerNameFontSize: z.number().positive().default(128),
  championshipNameFontSize: z.number().positive().default(64),
}) satisfies z.ZodType<LaborOfLoveLowerThirdProps>

export const laborOfLoveLowerThirdTemplateSchema: TemplateSchema<LaborOfLoveLowerThirdProps> = {
  id: 'labor-of-love-lower-third',
  name: 'Labor of Love Lower Third',
  route: '/graphics/labor-of-love/lower-third',
  schema: laborOfLoveLowerThirdSchema,
  defaults: laborOfLoveLowerThirdProps,
  fields: {
    championshipName: { label: 'Championship', section: 'TEMPLATE DATA' },
    workerName: { label: 'Worker', section: 'TEMPLATE DATA' },
    championshipNameFontSize: {
      label: 'Champ size',
      section: 'TEMPLATE DATA',
      type: 'slider',
      unit: 'PX',
      min: 24,
      max: 120,
      step: 1,
    },
    workerNameFontSize: {
      label: 'Worker size',
      section: 'TEMPLATE DATA',
      type: 'slider',
      unit: 'PX',
      min: 48,
      max: 200,
      step: 1,
    },
  },
  transition: { inMs: 1000, outMs: 750 },
}
