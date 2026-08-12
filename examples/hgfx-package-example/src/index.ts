import { definePackage, defineTemplate } from '@hydra-tv/hydra-gfx-sdk'
import { exampleLowerThirdTemplateSchema } from './templates/lower-third/schema'
import { exampleTickerTemplateSchema } from './templates/ticker/schema'
import {
  exampleConfigDefaults,
  exampleConfigSchema,
  exampleTickerDataSchema,
  exampleTickerProvider,
} from './live-data'

export default definePackage({
  id: 'example-pkg',
  name: 'Example Package',
  version: '0.1.0',
  // Package-level config — edited from the EXAMPLE rundown tab (see panels).
  config: {
    schema: exampleConfigSchema,
    defaults: exampleConfigDefaults,
    fields: { prefix: { label: 'Prefix' } },
  },
  // Rundown-scoped live-data keys this package publishes/reads.
  data: { ticker: exampleTickerDataSchema },
  // In-process provider — starts automatically once a rundown attaches this package.
  providers: [exampleTickerProvider],
  // Top-level rundown tab (appears when this package is attached).
  panels: [
    {
      id: 'config',
      label: 'EXAMPLE',
      Panel: () => import('./panels/ConfigPanel'),
    },
  ],
  templates: [
    defineTemplate({
      ...exampleLowerThirdTemplateSchema,
      Render: () => import('./templates/lower-third/Graphic'),
      Controls: () => import('./templates/lower-third/Controls'),
      PreviewControls: () => import('./templates/lower-third/Controls'),
    }),
    defineTemplate({
      ...exampleTickerTemplateSchema,
      Render: () => import('./templates/ticker/Graphic'),
    }),
  ],
})
