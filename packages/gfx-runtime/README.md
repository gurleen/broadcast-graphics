# `@hydra-tv/hydra-gfx-runtime`

Shared template runtime for **HYDRA // GFX**: `HtmlCanvas`, layout primitives, colors, and template types used by both the host app and external `.hgfx.js` packages.

## Install

```bash
bun add @hydra-tv/hydra-gfx-runtime react zod
```

## Usage

```ts
import { HtmlCanvas, GRAPHIC_WIDTH, GRAPHIC_HEIGHT } from '@hydra-tv/hydra-gfx-runtime'
import type { TemplateRenderProps } from '@hydra-tv/hydra-gfx-runtime/types'
```

Author packages with [`@hydra-tv/hydra-gfx-sdk`](https://www.npmjs.com/package/@hydra-tv/hydra-gfx-sdk). Full guide: [template packages](https://github.com/gurleen/broadcast-graphics/blob/main/docs/template-packages.md).
