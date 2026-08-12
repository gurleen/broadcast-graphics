# AGENTS.md — HYDRA // GFX

Orientation for coding agents working in this repo. Read this before editing. UI component libraries live in the separate [gurleen/ui](https://github.com/gurleen/ui) repo and are consumed from npm as `@hydra-tv/*`. Control-plane protocol detail: [`docs/control-plane.md`](./docs/control-plane.md). Dynamic template packages: [`docs/template-packages.md`](./docs/template-packages.md). Package-level config, rundown live data, and in-process providers: [`docs/live-data.md`](./docs/live-data.md).

## What this repo is

**HYDRA // GFX** — broadcast graphics for OBS (transparent 1920×1080) plus an operator control plane:

- Bun + Hono REST/WS at `/api/control`, SQLite-backed rundowns/instances
- Operator UI at `/control` (and home launcher at `/`)
- Per-template routes under `/graphics/*` and composite `/render` (active rundown) / `/render/$rundownId`
- Optional Tauri 2 desktop shell (sidecar on `127.0.0.1:4737`)

Product brand string: `HYDRA // GFX` (document title, NavBar brand, Tauri `productName` / window title / loading splash).

## Hard constraints

1. **Bun only** for control plane / production serve — uses `bun:sqlite`. Never assume Node can run `serve.ts` or tests that open the DB.
2. **Transparent graphics** — `/graphics/*` and `/render/*` must not paint opaque `html`/`body` backgrounds (OBS alpha). `GraphicStage` forces transparency outside preview mode.
3. **Tally colors are semantic** — `--tally-pgm` (red) = program/on-air, `--tally-pvw` (green) = preview/next. Never use them decoratively.
4. **Reusable UI comes from `@hydra-tv/*` npm packages** — generic → `@hydra-tv/ui`; broadcast-domain only → `@hydra-tv/broadcast`. Do not invent one-off styled primitives in routes when a core component fits (or should be added upstream).
5. **Control chrome styling** — `@hydra-tv/tokens` + inline `style` objects. Tailwind exists in the Vite app (`styles.css`) but is **not** the control UI system; prefer tokens (`var(--bg-1)`, `--fg-*`, `--font-mono`, …).

## Directory map

| Path | Role |
|------|------|
| `src/routes/` | TanStack file routes (`/`, `/control`, `/graphics`, `/render`) |
| `src/control/` | Control plane: Hono app, protocol, SQLite server, React client hooks |
| `src/templates/` | Dual template registries (`schemas.ts` server-safe, `registry.tsx` / `registry-static.ts` client) |
| `src/packages/` | Dynamic `.hgfx.js` package runtime registry + browser loader |
| `packages/gfx-runtime` | `@hydra-tv/hydra-gfx-runtime` — shared template engine (`HtmlCanvas`, colors, types) |
| `packages/gfx-sdk` | `@hydra-tv/hydra-gfx-sdk` — `definePackage` / `hydra-gfx build` CLI (npm-publishable) |
| `examples/hgfx-package-example` | Sample external package (motion + gsap templates) |
| `src/html/` | Re-exports from `@hydra-tv/hydra-gfx-runtime` (compat shims) |
| `server/app.ts` | Re-export of control Hono app for Bun servers |
| `scripts/` | Desktop prepare / sidecar / SPA index writer |
| `src-tauri/` | Tauri shell; navigates to `/` after sidecar READY |
| `docs/` | Control-plane reference |
| `data/` | Local SQLite (gitignored) |
| `dev-server.ts` / `serve.ts` / `serve-desktop.ts` | Dev / prod / desktop entrypoints |

Import alias: `#/*` → `src/*` (also configured in `tsconfig`). Prefer `#/control/client`, `#/templates/...`, etc.

## Route map

```
/                              Home launcher (LauncherTile → /control)
/control                       Layout: NavBar (HYDRA // GFX), StatusBar, ToastProvider
/control/                      Rundown list
/control/$rundownId            Tabbed rundown shell
/control/$rundownId/           Playout (grid, PVW/PGM, properties)
/control/$rundownId/templates
/control/$rundownId/packages   Attach/detach packages, providers, live data (docs/live-data.md)
/control/$rundownId/renderers
/control/$rundownId/panel/$packageId/$panelId   Package-registered control panel (attached packages only)
/graphics/<show>/<name>        Template renderer (+ GraphicStage)
/render                        Default composite (follows active/open rundown)
/render/$rundownId             Composite of on-air instances
/api/control/*                 REST + WS (not a TanStack route — Hono)
```

Route files prefixed with `-` (e.g. `-Graphic.tsx`, `-schema.ts`) are **not** routes — TanStack ignores them via `routeFileIgnorePrefix: "-"`.

## How to add a graphic template

1. Create `src/routes/graphics/<show>/<name>/` with:
   - `-types.ts` — props type + defaults
   - `-schema.ts` — Zod schema + `TemplateSchema` (`id`, `name`, `route`, `defaults`, optional `fields`, `transition`)
   - `-Graphic.tsx` — visual (prefer `HtmlCanvas` / `src/html/ui` unless you need WebGL)
   - `route.tsx` — `createFileRoute`, call `useControlledGraphic(schema)`, render graphic; optional preview toolbar portal
   - Optional: `-Controls.tsx` (operator property UI), `-PreviewToolbarControls.tsx`
2. Register schema in **`src/templates/schemas.ts`** (server / REST catalog).
3. Register definition in **`src/templates/registry.tsx`** (`Render` + optional `Controls`).
4. Drive from control: create rundown → add instance with that `templateId` → open  
   `/graphics/...?rundown=&instance=`, `/render` (active rundown), or `/render/$rundownId`.  
   Preview locally: `?preview=1` (checkerboard + toolbar).

Copy an existing folder (`labor-of-love/lower-third` or `drexel/basketball-scorebug`) rather than inventing a new layout from scratch.

**External packages:** templates can also ship as compiled `.hgfx.js` artifacts from separate repos (no static registry edit). See [`docs/template-packages.md`](./docs/template-packages.md) and `examples/hgfx-package-example`. Install via `/control/packages` or `data/packages/`; routes are `/graphics/p/<packageId>/<templateId>`.

### Engines

| Engine | Use when |
|--------|----------|
| `@hydra-tv/hydra-gfx-runtime` / `src/html` (`HtmlCanvas`) | Default — DOM + Motion; all current live templates |
| `src/graphics` (`GraphicCanvas`) | R3F / Yoga WebGL when GPU/3D layout is required |

Shared frame size: `GRAPHIC_WIDTH` / `GRAPHIC_HEIGHT` in `src/graphics/constants.ts` (1920×1080).

## How to change the control UI

- Shell: `src/routes/control/route.tsx` (brand → `/`, StatusBar API/rundown counts).
- Rundown list: `src/routes/control/index.tsx`.
- Playout: `src/routes/control/$rundownId/index.tsx` + `-PropertyPanel`, `-MonitorWell`, `-AddInstanceDialog`.
- Home launcher: `src/routes/index.tsx` (`LauncherTile` from `@hydra-tv/ui`).

Use hooks from `#/control/client`:

| Hook | Use |
|------|-----|
| `useRundownList()` | List/create rundowns (REST) |
| `useRundownController(id)` | WS snapshot + playout/props commands |
| `useTemplateCatalog()` | Template list for add-instance |
| `useControlledGraphic(schema)` | Graphic routes (local vs `?rundown=&instance=`) |

New control pages: add a file under `src/routes/control/` (or `$rundownId/`), wire tabs in `$rundownId/route.tsx` if needed.

## How to change the control plane

| Area | Files |
|------|--------|
| REST/WS surface | `src/control/app.ts` |
| Wire protocol | `src/control/protocol.ts` |
| Domain models | `src/control/model.ts` |
| Mutations | `src/control/server/commands.ts` → `store.ts` |
| Pub/sub | `src/control/server/hub.ts` |
| Renderer sessions | `src/control/server/sessions.ts` |
| DB path | `src/control/server/db.ts` (`CONTROLLER_DB` or `data/controller.db`) |

After protocol/command changes, extend `src/control/control.test.ts` and run `bun test`.

## Desktop / Tauri notes

- Loading splash: `src-tauri/loading/index.html` (shown until sidecar READY).
- After READY, `src-tauri/src/lib.rs` `navigate_main` opens `{origin}/` (not `/control`).
- SPA shell for desktop is written by `scripts/write-desktop-index.ts` (fetches `/`).
- `productName` / window title: `HYDRA // GFX` in `tauri.conf.json` + `lib.rs`.

## UI packages

Control chrome uses npm packages from the [gurleen/ui](https://github.com/gurleen/ui) monorepo:

- `@hydra-tv/tokens` — CSS variables
- `@hydra-tv/ui` — generic controls
- `@hydra-tv/broadcast` — broadcast-domain components

To bump versions, edit `package.json` and run `bun install`. Component changes belong in the upstream repo; publish new npm versions there first.

Tokens load once via `import '@hydra-tv/tokens'` in `src/routes/__root.tsx`.

## Testing & verify

```bash
bun test                 # control plane
bun run dev              # manual UI / graphics
bun run build            # production client+SSR
```

No Storybook in the app — visual checks for `@hydra-tv/*` use the playground in the upstream [gurleen/ui](https://github.com/gurleen/ui) repo.

## Stale / avoid

- Do not resurrect TanStack Start demo prose or `src/routes/demo/` — it does not exist.
- Do not treat Tailwind as the control design system.
- Do not put broadcast-only widgets in `@hydra-tv/ui` or generic widgets in `@hydra-tv/broadcast`.
