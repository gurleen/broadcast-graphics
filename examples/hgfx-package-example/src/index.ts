import { definePackage, defineTemplate } from '@hydra-tv/hydra-gfx-sdk'
import { exampleLowerThirdTemplateSchema } from './templates/lower-third/schema'
import { exampleTickerTemplateSchema } from './templates/ticker/schema'

export default definePackage({
  id: 'example-pkg',
  name: 'Example Package',
  version: '0.1.0',
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
