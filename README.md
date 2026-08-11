# HYDRA // GFX

Broadcast graphics control plane and operator UI for DragonsTV. Transparent 1920×1080 graphics for OBS browser sources, driven by a Bun + SQLite control server and a Tauri desktop shell.

For agent-oriented orientation (how to add graphics, control pages, UI components), see **[AGENTS.md](./AGENTS.md)**.

## Quick start

```bash
bun install
bun run dev
```

Open **http://localhost:3000**. Dev runs [`dev-server.ts`](./dev-server.ts): Bun on port **3000**, Vite HMR on 5173 (proxied). The control API is at `/api/control`.

**Requires Bun** for anything that touches the control plane (`bun:sqlite`). Do not run production under Node.

## Surfaces

| Path | Purpose |
|------|---------|
| `/` | Home launcher (`HYDRA // GFX`) |
| `/control` | Operator UI — rundowns, playout, templates, renderers |
| `/graphics/...` | Per-template graphic (OBS browser source) |
| `/render` | Default composite — follows the currently open rundown |
| `/render/<rundownId>` | Composite renderer for a specific rundown |
| `/api/control` | REST + WebSocket control plane |

Brand chrome uses `@hydra-tv/tokens`. Graphics routes stay transparent for OBS (no opaque page background).

## UI libraries

Published npm packages from [gurleen/ui](https://github.com/gurleen/ui):

- `@hydra-tv/tokens` — CSS variables (loaded once in [`src/routes/__root.tsx`](./src/routes/__root.tsx))
- `@hydra-tv/ui` — generic controls (`Button`, `Panel`, `DataGrid`, `LauncherTile`, …)
- `@hydra-tv/broadcast` — broadcast-domain (`Tally`, `StatusBar`, `TransportControls`, …)

App imports use the `#/*` alias → `src/*` (e.g. `#/control/client`).

## Graphics control plane

Rundowns and graphic instances (props + playout intent) live in SQLite (`data/controller.db`, overridable via `CONTROLLER_DB`). Renderers and the control UI sync over WebSocket.

**Full reference:** [docs/control-plane.md](./docs/control-plane.md).

### REST (summary)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/control/health` | Liveness + protocol version |
| `GET` | `/api/control/templates` | Registered templates |
| `GET` | `/api/control/rundowns` | List rundowns |
| `POST` | `/api/control/rundowns` | Create rundown `{ name }` |
| `GET` | `/api/control/rundowns/:id` | Full snapshot |
| `POST` | `/api/control/rundowns/:id/commands` | Apply command(s) |
| `GET` | `/api/control/active-rundown` | Default `/render` target `{ rundownId }` |
| `PUT` | `/api/control/active-rundown` | Set default target `{ rundownId }` |

```bash
curl -s -X POST localhost:3000/api/control/rundowns \
  -H 'content-type: application/json' -d '{"name":"Show"}'
# then instance.add / playout.in via /commands — see docs/control-plane.md
```

Browser sources:

- Single graphic: `/graphics/labor-of-love/lower-third?rundown=$ID&instance=$INSTANCE_ID`
- Default composite (follows open rundown): `/render`
- Specific rundown: `/render/$ID`

Client hooks: `#/control/client` (`useRundownController`, `useControlledGraphic`, …).

## Desktop (Tauri)

Tauri 2 shell around a Bun sidecar ([`serve-desktop.ts`](./serve-desktop.ts)). Sidecar binds **loopback only** on port **4737**. The window opens `/`.

**Prerequisites:** Rust, Xcode CLT (macOS), Bun.

```bash
bun install
bun run tauri:dev      # prepare:desktop then open the app
bun run tauri:build
```

`prepare:desktop` builds the Vite client, writes an SPA `dist/client/index.html` shell for `/`, `/control`, `/render/*`, `/graphics/*`, then compiles the sidecar.

| Surface | URL (same Mac / OBS) |
|---------|----------------------|
| Home | `http://127.0.0.1:4737/` |
| Control UI | `http://127.0.0.1:4737/control` |
| Composite (default) | `http://127.0.0.1:4737/render` |
| Composite (fixed) | `http://127.0.0.1:4737/render/<rundownId>` |
| Graphic | `http://127.0.0.1:4737/graphics/...` |

Override port with `PORT`. Desktop SQLite uses the OS app-data directory (`CONTROLLER_DB`), not the read-only bundle.

## Production (browser / remote OBS)

```bash
bun run build
bun run start          # serve.ts — Bun.serve + control plane
```

## Scripts

| Script | What it does |
|--------|----------------|
| `bun run dev` | Hot Bun + Vite proxy on :3000 |
| `bun run build` | Production Vite build |
| `bun run start` | Serve built app + control API |
| `bun test` | Control-plane tests (`CONTROLLER_DB=:memory:`) |
| `bun run build:packages` | Build `@hydra-tv/hydra-gfx-runtime` + `@hydra-tv/hydra-gfx-sdk` |
| `bun run publish:packages` | Build then `npm publish` both packages (runtime first) |
| `bun run prepare:desktop` | Client shell + sidecar binary |
| `bun run tauri:dev` / `tauri:build` | Desktop app |

## Template SDK (npm)

External graphic packages depend on:

- [`@hydra-tv/hydra-gfx-runtime`](./packages/gfx-runtime) — `HtmlCanvas`, layout primitives, types
- [`@hydra-tv/hydra-gfx-sdk`](./packages/gfx-sdk) — `definePackage` + `hydra-gfx` CLI (Bun required)

See [docs/template-packages.md](./docs/template-packages.md). To publish from this repo after `npm login`: `bun run publish:packages`.

## Known follow-ups

- Server-authoritative game clocks (scorebug still uses local `setInterval`; multi-source clocks can drift)
