import { z } from 'zod'
import type { TemplateSchema } from '@hydra/gfx-runtime/types'

export type ExampleLowerThirdProps = {
  title: string
  subtitle: string
  accent: string
}

export const exampleLowerThirdDefaults: ExampleLowerThirdProps = {
  title: 'EXAMPLE LOWER THIRD',
  subtitle: 'Dynamic package template',
  accent: '#FFC600',
}

export const exampleLowerThirdSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  accent: z.string(),
}) satisfies z.ZodType<ExampleLowerThirdProps>

export const exampleLowerThirdTemplateSchema: TemplateSchema<ExampleLowerThirdProps> = {
  id: 'example-lower-third',
  name: 'Example Lower Third',
  route: '/graphics/p/example-pkg/example-lower-third',
  schema: exampleLowerThirdSchema,
  defaults: exampleLowerThirdDefaults,
  fields: {
    title: { label: 'Title', section: 'CONTENT' },
    subtitle: { label: 'Subtitle', section: 'CONTENT' },
    accent: { label: 'Accent', section: 'STYLE', type: 'color' },
  },
  transition: { inMs: 600, outMs: 400 },
}
