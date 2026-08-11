import { z } from 'zod'
import type { TemplateSchema } from '@hydra/gfx-runtime/types'

export type ExampleTickerProps = {
  message: string
  speed: number
}

export const exampleTickerDefaults: ExampleTickerProps = {
  message: 'GSAP TICKER — bundled animation engine, not shared with the host',
  speed: 1,
}

export const exampleTickerSchema = z.object({
  message: z.string(),
  speed: z.number().positive().default(1),
}) satisfies z.ZodType<ExampleTickerProps>

export const exampleTickerTemplateSchema: TemplateSchema<ExampleTickerProps> = {
  id: 'example-gsap-ticker',
  name: 'Example GSAP Ticker',
  route: '/graphics/p/example-pkg/example-gsap-ticker',
  schema: exampleTickerSchema,
  defaults: exampleTickerDefaults,
  fields: {
    message: { label: 'Message', section: 'CONTENT' },
    speed: { label: 'Speed', section: 'MOTION', type: 'slider', min: 0.25, max: 3, step: 0.25 },
  },
  transition: { inMs: 500, outMs: 400 },
}
