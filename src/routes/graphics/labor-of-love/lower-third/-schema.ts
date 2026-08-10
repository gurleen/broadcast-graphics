import { z } from 'zod'
import { laborOfLoveLowerThirdProps, type LaborOfLoveLowerThirdProps } from './-types'
import type { TemplateSchema } from '#/templates/types'

export type { LaborOfLoveLowerThirdProps } from './-types'
export { laborOfLoveLowerThirdProps } from './-types'

export const laborOfLoveLowerThirdSchema = z.object({
  workerName: z.string(),
  championshipName: z.string(),
}) satisfies z.ZodType<LaborOfLoveLowerThirdProps>

export const laborOfLoveLowerThirdTemplateSchema: TemplateSchema<LaborOfLoveLowerThirdProps> = {
  id: 'labor-of-love-lower-third',
  name: 'Labor of Love Lower Third',
  schema: laborOfLoveLowerThirdSchema,
  defaults: laborOfLoveLowerThirdProps,
  fields: {
    championshipName: { label: 'Championship', section: 'TEMPLATE DATA' },
    workerName: { label: 'Worker', section: 'TEMPLATE DATA' },
  },
}
