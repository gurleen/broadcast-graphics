# AGENTS.md — HYDRA // GFX

Orientation for coding agents working in this repo. Read this before editing. For the `@gurleen-ui` submodule specifically, also read [`ui/AGENTS.md`](./ui/AGENTS.md). Control-plane protocol detail: [`docs/control-plane.md`](./docs/control-plane.md).

## What this repo is

**HYDRA // GFX** — broadcast graphics for OBS (transparent 1920×1080) plus an operator control plane:

- Bun + Hono REST/WS at `/api/control`, SQLite-backed rundowns/instances
- Operator UI at `/control` (and home launcher at `/`)
- Per-template routes under `/graphics/*` and composite `/render/$rundownId`
- Optional Tauri 2 desktop shell (sidecar on `127.0.0.1:4737`)

Product brand string: `HYDRA // GFX` (document title, NavBar brand, Tauri `productName` / window title / loading splash).

## Hard constraints

1. **Bun only** for control plane / production serve — uses `bun:sqlite`. Never assume Node can run `serve.ts` or tests that open the DB.
2. **Transparent graphics** — `/graphics/*` and `/render/*` must not paint opaque `html`/`body` backgrounds (OBS alpha). `GraphicStage` forces transparency outside preview mode.
3. **Tally colors are semantic** — `--tally-pgm` (red) = program/on-air, `--tally-pvw` (green) = preview/next. Never use them decoratively. See `ui/AGENTS.md`.
4. **`ui/` is a git submodule** — changes to components belong in that repo; bump the submodule pointer in this repo after pushing `ui`. Rebuild with `bun run build:ui` (or rely on `predev`/`prebuild`).
5. **Reusable UI goes in `@gurleen-ui`** — generic → `ui/packages/core`; broadcast-domain only → `ui/packages/broadcast`. Do not invent one-off styled primitives in routes when a core component fits (or should be added to core).
6. **Control chrome styling** — `@gurleen-ui` tokens + inline `style` objects. Tailwind exists in the Vite app (`styles.css`) but is **not** the control UI system; prefer tokens (`var(--bg-1)`, `--fg-*`, `--font-mono`, …).

## Directory map

| Path | Role |
|------|------|
| `src/routes/` | TanStack file routes (`/`, `/control`, `/graphics`, `/render`) |
| `src/control/` | Control plane: Hono app, protocol, SQLite server, React client hooks |
| `src/templates/` | Dual template registries (`schemas.ts` server-safe, `registry.tsx` client) |
| `src/graphics/` | R3F/WebGL engine + `GraphicStage` + preview toolbar |
| `src/html/` | DOM/`HtmlCanvas` engine (what live templates use today) |
| `server/app.ts` | Re-export of control Hono app for Bun servers |
| `scripts/` | Desktop prepare / sidecar / SPA index writer |
| `src-tauri/` | Tauri shell; navigates to `/` after sidecar READY |
| `ui/` | `@gurleen-ui` submodule |
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
/control/$rundownId/renderers
/graphics/<show>/<name>        Template renderer (+ GraphicStage)
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
   `/graphics/...?rundown=&instance=` or `/render/$rundownId`.  
   Preview locally: `?preview=1` (checkerboard + toolbar).

Copy an existing folder (`labor-of-love/lower-third` or `drexel/basketball-scorebug`) rather than inventing a new layout from scratch.

### Engines

| Engine | Use when |
|--------|----------|
| `src/html` (`HtmlCanvas`) | Default — DOM + Motion; all current live templates |
| `src/graphics` (`GraphicCanvas`) | R3F / Yoga WebGL when GPU/3D layout is required |

Shared frame size: `GRAPHIC_WIDTH` / `GRAPHIC_HEIGHT` in `src/graphics/constants.ts` (1920×1080).

## How to change the control UI

- Shell: `src/routes/control/route.tsx` (brand → `/`, StatusBar API/rundown counts).
- Rundown list: `src/routes/control/index.tsx`.
- Playout: `src/routes/control/$rundownId/index.tsx` + `-PropertyPanel`, `-MonitorWell`, `-AddInstanceDialog`.
- Home launcher: `src/routes/index.tsx` (`LauncherTile` from `@gurleen-ui/core`).

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

## UI submodule workflow

```bash
# In ui/ — add/change component per ui/AGENTS.md, then:
cd ui && npm run build -w @gurleen-ui/core   # or full npm run build
# commit + push ui, then in this repo:
git add ui && git commit -m "chore: bump ui submodule"
bun run build:ui   # refresh app's linked dist if needed
```

Tokens load once via `import '@gurleen-ui/tokens'` in `src/routes/__root.tsx`.

## Testing & verify

```bash
bun test                 # control plane
bun run dev              # manual UI / graphics
bun run build            # production client+SSR
```

No Storybook in the app — visual checks for `@gurleen-ui` use `ui/apps/playground` (`npm run dev` inside `ui/`).

## Stale / avoid

- Do not resurrect TanStack Start demo prose or `src/routes/demo/` — it does not exist.
- Do not treat Tailwind as the control design system.
- Do not put broadcast-only widgets in `@gurleen-ui/core` or generic widgets in `broadcast`.
