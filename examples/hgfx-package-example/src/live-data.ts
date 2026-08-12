import { z } from 'zod'
import { defineProvider } from '@hydra-tv/hydra-gfx-sdk'

/**
 * Demonstrates the live-data subsystem end to end (see `docs/live-data.md`):
 * a package-level config (`prefix`), a rundown-scoped live-data key
 * (`ticker`), an in-process provider that publishes it, and a template
 * binding (`live.bind`) that projects it onto a prop — see
 * `templates/ticker/schema.ts` for the binding, and `index.ts` for wiring.
 */

export const exampleConfigSchema = z.object({
  prefix: z.string(),
})
export type ExampleConfig = z.infer<typeof exampleConfigSchema>

export const exampleConfigDefaults: ExampleConfig = { prefix: 'BREAKING' }

export const exampleTickerDataSchema = z.object({ message: z.string() })

const HEADLINES = [
  'Live-data subsystem online',
  'Package config drives the prefix',
  'Provider publishing on a timer',
  'Bound onto the ticker prop via live.bind',
]

/** A trivial "live feed" — swap the interval for a real fetch() in a real package. */
export const exampleTickerProvider = defineProvider<ExampleConfig>({
  id: 'example-ticker-feed',
  name: 'Example ticker feed',
  publishes: ['ticker'],
  start: (ctx) => {
    let i = 0
    const tick = () => {
      ctx.publish('ticker', { message: `${ctx.config.prefix}: ${HEADLINES[i % HEADLINES.length]}` })
      i += 1
    }
    tick()
    const interval = setInterval(tick, 4000)
    ctx.log('started')
    return () => clearInterval(interval)
  },
})
