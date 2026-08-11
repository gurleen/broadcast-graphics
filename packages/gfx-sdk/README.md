# `@hydra-tv/hydra-gfx-sdk`

Authoring helpers (`definePackage` / `defineTemplate`) and the **`hydra-gfx`** CLI that compiles template packages into single-file `.hgfx.js` artifacts for HYDRA // GFX.

Requires [Bun](https://bun.sh) (`>=1.1`) — the CLI uses `Bun.build`.

## Install

```bash
bun add @hydra-tv/hydra-gfx-sdk @hydra-tv/hydra-gfx-runtime react zod motion
```

## Author

```ts
import { definePackage, defineTemplate } from '@hydra-tv/hydra-gfx-sdk'

export default definePackage({
  id: 'my-show',
  name: 'My Show',
  version: '1.0.0',
  templates: [
    defineTemplate({
      id: 'lower-third',
      name: 'Lower Third',
      schema: mySchema,
      defaults: { ... },
      Render: () => import('./templates/lower-third/Graphic'),
    }),
  ],
})
```

## Build

```bash
bunx hydra-gfx build --out /path/to/hydra/data/packages
# watch:
bunx hydra-gfx build --watch --out /path/to/hydra/data/packages
```

Full guide: [template packages](https://github.com/gurleen/broadcast-graphics/blob/main/docs/template-packages.md).
