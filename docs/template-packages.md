# Template packages

HYDRA // GFX can load **compiled template packages** (`.hgfx.js`) at runtime. Each package is authored in its own repo (or folder), built with the `@hydra-tv/hydra-gfx-sdk` CLI, and installed by dropping the artifact into `data/packages/` or uploading it on **Control → Packages**.

Built-in templates (`labor-of-love-*`, `drexel-basketball-scorebug`) remain statically compiled and always available.

## Artifact format

A `.hgfx.js` file is a single ES module with two exports:

| Export | Contents |
|--------|----------|
| `export default` | `definePackage({ id, name, version, config?, data?, datasets?, providers?, panels?, templates })` — live zod schemas + **lazy** `Render` / `Controls` / `PreviewControls` / panel `Panel` factories, plus optional live-data declarations (see below) |
| `export const manifest` | Pure JSON metadata: `formatVersion`, `runtime` range, package info, per-template `defaults` / `fields` / `transition` / `live` / `jsonSchema`, plus package `config` / `dataKeys` / `datasets` / `providers` / `panels` descriptors |

A package that only ships templates can ignore `config` / `data` / `datasets` / `providers` / `panels` entirely — they're additive. See [`docs/live-data.md`](./live-data.md) for the full live-data model (package-level config, control panels as rundown tabs, rundown-scoped data keys, in-process providers, and binding live data onto template props via `live.bind`).

Shared host libraries are **not** bundled. The CLI rewrites those imports to:

```js
globalThis.__HYDRA_GFX_RUNTIME__.require('react')
```

The host installs that registry once (browser: `src/packages/runtime.ts`, Bun: `src/packages/runtime.server.ts`).

### Shared vs bundled

Configure in `hydra.config.ts`:

```ts
export default {
  entry: 'src/index.ts',
  shared: [
    'react',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
    '@hydra-tv/hydra-gfx-runtime',
    'motion/react',   // optional — remove to bundle your own copy
    'zod',
    '@hydra-tv/ui',
  ],
  runtime: '^0.1.0',
}
```

- **Mandatory shared:** `react`, `react/jsx-runtime`, `react/jsx-dev-runtime`, `@hydra-tv/hydra-gfx-runtime`
- **Default shared (removable):** `motion/react`, `zod`, `@hydra-tv/ui`, `@hydra-tv/broadcast`
- **Everything else is bundled** (e.g. `gsap`) — see `examples/hgfx-package-example` ticker template

## Authoring a package

```bash
# In your package repo
bun add @hydra-tv/hydra-gfx-sdk @hydra-tv/hydra-gfx-runtime react zod motion
# optional: @hydra-tv/ui gsap …

# src/index.ts
import { definePackage, defineTemplate } from '@hydra-tv/hydra-gfx-sdk'
import { mySchema } from './templates/foo/schema'

export default definePackage({
  id: 'my-show',
  name: 'My Show',
  version: '1.0.0',
  templates: [
    defineTemplate({
      ...mySchema,
      Render: () => import('./templates/foo/Graphic'),
      Controls: () => import('./templates/foo/Controls'), // optional
      PreviewControls: () => import('./templates/foo/Controls'), // optional
    }),
  ],
})
```

Component fields **must** be lazy factories (`() => import(...)`) so Bun can import the artifact for schema validation without evaluating DOM libraries.

```bash
bunx hydra-gfx build --out /path/to/hydra/data/packages
# or watch during development:
bunx hydra-gfx build --watch --out /path/to/hydra/data/packages
```

## Installing on the host

1. Copy `*.hgfx.js` into `data/packages/`, **or**
2. Open `/control/packages` and upload the file

The control plane scans the directory at boot, watches for changes, and merges package templates into `GET /api/control/templates`. Dynamic templates use routes:

```
/graphics/p/<packageId>/<templateId>
```

Composite PGM (`/render/$rundownId`) and the property panel load package bundles on demand. Custom `Controls` from the package replace the auto-generated fields UI when present.

## Example

See [`examples/hgfx-package-example`](../examples/hgfx-package-example):

- `example-lower-third` — motion (shared) + custom Controls (`@hydra-tv/ui`)
- `example-gsap-ticker` — gsap **bundled** into the artifact

```bash
cd examples/hgfx-package-example
bun install
bun run build   # writes data/packages/example-pkg.hgfx.js
```

## API

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/control/packages` | List installed packages |
| `POST` | `/api/control/packages` | Upload (multipart `file` or raw body) |
| `DELETE` | `/api/control/packages/:id` | Remove |
| `POST` | `/api/control/packages/reload` | Rescan `data/packages` |
| `GET` | `/api/control/packages/:id/bundle.js` | Serve artifact (`Cache-Control: no-store`; use `?v=<hash>`) |

WS event `packages.changed` is broadcast to all sessions after reload.
