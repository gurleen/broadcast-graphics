# Example HYDRA // GFX template package

Demonstrates compiling an independent template package into a single `.hgfx.js` artifact.

## Templates

| id | Notes |
|----|-------|
| `example-lower-third` | Uses shared `motion/react` + custom `@gurleen-ui/core` Controls |
| `example-gsap-ticker` | Bundles **gsap** (not shared) — bring-your-own animation library |

## Build

```bash
bun install
bun run build
# → ../../data/packages/example-pkg.hgfx.js

# Dev loop (rebuild into host packages dir on change):
bun run watch
```

Then open the host at `/control/packages` (or just drop the file — the host watches `data/packages/`).

Preview:

- `/graphics/p/example-pkg/example-lower-third?preview=1`
- `/graphics/p/example-pkg/example-gsap-ticker?preview=1`
