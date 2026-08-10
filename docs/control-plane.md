# Graphics control plane

Real-time control of broadcast graphics over REST and WebSockets. No control UI yet — this document covers the APIs and client hooks a UI (or automation) will use.

## Architecture

```
Browser graphic  ──WS──┐
Control UI (future) ───┼── Bun (dev-server.ts / serve.ts)
Automation / curl ─REST┘         │
                                 ▼
                          Hono /api/control
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
               commands.ts     hub.ts    sessions.ts
                    │            │            │
                    ▼            │            │
               store.ts ─────────┘            │
                    │                         │
                    ▼                         ▼
            bun:sqlite (durable)     in-memory renderers
```

- **Durable state** (SQLite): rundowns, instances, props, playout intent (`in` / `out`).
- **Ephemeral state** (memory): connected renderer/control sessions and reported playback phases.
- Every mutation goes through `applyCommand` → events published on an in-process hub → all WebSocket subscribers for that rundown.

Key paths:

| Path | Role |
|------|------|
| [`src/control/app.ts`](../src/control/app.ts) | Hono REST + WS |
| [`server/app.ts`](../server/app.ts) | Re-export for Bun servers |
| [`src/control/model.ts`](../src/control/model.ts) | Zod domain models |
| [`src/control/protocol.ts`](../src/control/protocol.ts) | Wire protocol (v1) |
| [`src/control/server/`](../src/control/server/) | DB, store, commands, hub, sessions |
| [`src/control/client/`](../src/control/client/) | Socket, store, React hooks |
| [`src/templates/schemas.ts`](../src/templates/schemas.ts) | Server-safe template registry |
| [`src/templates/registry.tsx`](../src/templates/registry.tsx) | Client Render/Controls map |

Persistence: `data/controller.db` (gitignored), override with `CONTROLLER_DB` (`:memory:` for tests). Production must run under **Bun** (`bun run start`) because of `bun:sqlite`.

## Data model

### Rundown

Named container of graphic instances. Holds an optional `cuedInstanceId` (PVW / next).

### Graphic instance

| Field | Meaning |
|-------|---------|
| `templateId` | Registry id (e.g. `labor-of-love-lower-third`) |
| `label` | Operator-facing name (`L3_001`) |
| `props` | Template-validated JSON |
| `playout.intent` | Authoritative `in` \| `out` (persisted) |
| `playout.onScreen` | Derived: `intent === 'in'` |
| `playout.cued` | Derived from rundown cue pointer |
| `revision` | Bumps on every props or playout change |
| `layer` / `sortOrder` | Composite render stacking |

### Playback phase (renderer-reported)

`unknown` → `offscreen` → `entering` → `onscreen` → `exiting` → `offscreen` (or `error`).

Aggregate phase for an instance (what a control UI shows as ON AIR / transitioning) is derived from attached renderer sessions — not stored.

## REST API

Base: `/api/control`

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | `{ ok, protocolVersion, serverTime }` |
| `GET` | `/templates` | Registered templates + JSON Schema |
| `GET` | `/rundowns` | List rundowns |
| `POST` | `/rundowns` | Create `{ name }` |
| `GET` | `/rundowns/:id` | Full snapshot |
| `POST` | `/rundowns/:id/commands` | One command body, or `{ commands: [...] }` |

`rundownId` is injected from the URL when omitted on commands that need it.

### Quick start

```bash
# Health
curl -s localhost:3000/api/control/health

# Create rundown
ID=$(curl -s -X POST localhost:3000/api/control/rundowns \
  -H 'content-type: application/json' \
  -d '{"name":"Show"}' | jq -r .rundown.id)

# Add lower third
INSTANCE=$(curl -s -X POST localhost:3000/api/control/rundowns/$ID/commands \
  -H 'content-type: application/json' \
  -d '{"type":"instance.add","templateId":"labor-of-love-lower-third","label":"L3_001"}' \
  | jq -r '.snapshot.instances[0].id')

# Take on air
curl -s -X POST localhost:3000/api/control/rundowns/$ID/commands \
  -H 'content-type: application/json' \
  -d "{\"type\":\"playout.in\",\"instanceId\":\"$INSTANCE\"}"

# Open as browser source
open "http://localhost:3000/graphics/labor-of-love/lower-third?rundown=$ID&instance=$INSTANCE"
```

## WebSocket protocol

Endpoint: `ws(s)://{host}/api/control/ws`  
`PROTOCOL_VERSION = 1`

### Client → server

| `type` | Payload |
|--------|---------|
| `hello` | `{ role: 'control' \| 'renderer', rundownId, instanceId?, templateId?, label?, protocolVersion }` |
| `subscribe` / `unsubscribe` | `{ rundownId }` |
| `command` | `{ commandId, command }` |
| `report` | `{ instanceId, phase, revision, message? }` |
| `ping` | `{ id? }` |

### Server → client

| `type` | Payload |
|--------|---------|
| `welcome` | `{ sessionId, serverTime, protocolVersion }` |
| `snapshot` | Full `RundownSnapshot` |
| `event` | `{ seq, event }` |
| `ack` | `{ commandId, ok, error?, events? }` |
| `pong` / `error` | — |

Invalid frames produce an `ack`/`error` with `code` + `message`; the socket stays open.

### Commands

`rundown.create` · `rundown.rename` · `rundown.delete`  
`instance.add` · `instance.remove` · `instance.relabel` · `instance.reorder`  
`instance.patchProps` · `instance.replaceProps` · `instance.resetProps`  
`playout.cue` · `playout.take` · `playout.in` · `playout.out` · `playout.toggle` · `playout.clearAll`

### Events

`rundown.upserted` · `rundown.removed`  
`instance.upserted` · `instance.removed` · `instance.props` (delta for high-frequency edits)  
`playout.changed` · `renderer.upserted` · `renderer.removed` · `error`

## Client hooks

Import from `#/control/client`.

### `useRundownController(rundownId)`

For a future control UI / operator surface:

- State: `snapshot`, `instances`, `renderers`, `status`, `log`
- Senders: `cue`, `take`, `in`, `out`, `toggle`, `clearAll`, `patchProps`, `replaceProps`, `addInstance`, `removeInstance`, `reorder`, …

### `useControlledGraphic(template)`

Drop-in for graphic routes:

- **No** `?rundown=` / `?instance=` → local state (preview toolbars work as before).
- **With** those search params → server state; `setProps` / `setOnScreen` become commands; playback phases are reported automatically via `usePlaybackReporter`.

### `useGraphicInstance` / `usePlaybackReporter`

Lower-level renderer hooks if a page needs finer control (e.g. `motion` `onAnimationComplete` → `reportPhase`).

## Graphic pages

Search params on `/graphics/*` (see [`src/routes/graphics/route.tsx`](../src/routes/graphics/route.tsx)):

| Param | Purpose |
|-------|---------|
| `preview` | Checkerboard + toolbar slot |
| `scale` | Force display scale |
| `rundown` | Control rundown id |
| `instance` | Control instance id |

Registered templates today:

- `labor-of-love-lower-third` → `/graphics/labor-of-love/lower-third`
- `labor-of-love-bracket` → `/graphics/labor-of-love/bracket`
- `drexel-basketball-scorebug` → `/graphics/drexel/basketball-scorebug`

Composite renderer (all instances, z-ordered): `/render/$rundownId`

## Templates

Server-safe half (`-schema.ts`) registers with [`src/templates/schemas.ts`](../src/templates/schemas.ts).  
Client half (`-Graphic.tsx`, optional Controls) registers with [`src/templates/registry.tsx`](../src/templates/registry.tsx).

`TemplateSchema` fields: `id`, `name`, `route`, `schema` (zod), `defaults`, optional `fields`, optional `transition: { inMs, outMs }`.

## Dev / prod wiring

- **Dev**: `bun --hot run dev-server.ts` — Vite HMR WS tagged `kind: 'vite-proxy'`; `/api/control/*` goes to Hono. Control-server modules live in the Bun process (hot-reloaded via `--hot`); SQLite/hub/sessions are cached on `globalThis`.
- **Prod**: `serve.ts` serves static + TanStack Start, and mounts the same Hono app + websocket handler.

## Tests

```bash
bun test
```

Coverage in [`src/control/control.test.ts`](../src/control/control.test.ts): protocol parsing, prop validation, cue/take/clearAll, revision bumps, snapshots (`CONTROLLER_DB=:memory:`).

## Follow-ups

- Control UI (operator rundown / playout / properties)
- Server-authoritative game clocks (scorebug `setInterval` is still local so multi-source clocks can drift)
