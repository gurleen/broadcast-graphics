# Live data

Package-level config, rundown-scoped live data (score, clock, stats, …), and the
in-process providers that feed it. This builds on
[`docs/control-plane.md`](./control-plane.md) and
[`docs/template-packages.md`](./template-packages.md) — read those first.

## Why this exists

Packages that render live sports/event graphics need more than a template
schema: a place to configure the game (home/away team, sport), a way to feed
live score/clock updates into instance props, and something to actually fetch
those updates. Hydra's answer:

- **Package config** — per-rundown settings for a package (`config` in
  `definePackage`), edited from the rundown's **PACKAGES** tab.
- **Rundown-scoped live data** — a small in-memory, last-value-wins key/value
  store per rundown (`data` in `definePackage` declares the key schemas).
- **Providers** — in-process server-side JavaScript that publishes into that
  store (`providers` in `definePackage` + `defineProvider`). No child
  processes, no interpreter discovery — a provider is just an async function
  running inside the same Bun process as the control plane.
- **Live bindings** — a template's `live.bind` declares which live data /
  config paths feed which prop paths. The server projects them into an
  in-memory **overlay** on top of an instance's persisted props, so a 1Hz
  clock costs zero SQLite writes.
- **Datasets** — remote reference data (team lists, rosters) a package wants
  Hydra to fetch + cache, available to providers via `ctx.dataset(id)` and to
  the browser via `GET /api/control/datasets/:packageId/:datasetId`.

## Rundowns opt in to packages

A package is **not** assumed to apply to every rundown. A rundown attaches a
package (`rundown.attachPackage`) to get its own config + live-data store +
running providers. Adding an instance whose template belongs to a package
auto-attaches that package (with default config) so the common path — add a
scorebug, it just works — needs no extra step. Detaching (`rundown.detachPackage`)
stops that package's providers for the rundown and keeps the config around in
case it's re-attached.

## Authoring: package config

```ts
import { definePackage, defineTemplate } from '@hydra-tv/hydra-gfx-sdk'
import { z } from 'zod'

export default definePackage({
  id: 'drexel-basketball',
  name: 'Drexel Basketball',
  version: '1.0.0',
  config: {
    schema: z.object({
      homeTeam: z.string(),
      awayTeam: z.string(),
      sport: z.enum(['basketball', 'volleyball']),
    }),
    defaults: { homeTeam: 'DREXEL', awayTeam: 'TBD', sport: 'basketball' },
    fields: {
      homeTeam: { label: 'Home team' },
      awayTeam: { label: 'Away team' },
      sport: { label: 'Sport', type: 'select', options: ['basketball', 'volleyball'] },
    },
  },
  templates: [/* ... */],
})
```

Editable from the rundown's **PACKAGES** tab (a generic form driven by
`config.fields` / JSON Schema). `rundown.patchConfig` / `rundown.replaceConfig`
validate against `config.schema` before writing.

## Authoring: live-data keys + providers

```ts
import { defineProvider } from '@hydra-tv/hydra-gfx-sdk'
import { z } from 'zod'

const GameState = z.object({
  homeScore: z.number(),
  awayScore: z.number(),
  clockMs: z.number(),
  period: z.number(),
})

const scoreProvider = defineProvider({
  id: 'live-score',
  name: 'Live score feed',
  publishes: ['game'],
  start: async (ctx) => {
    const poll = async () => {
      if (ctx.signal.aborted) return
      try {
        const res = await fetch(`https://example.com/games/${ctx.config.gameId}`, {
          signal: ctx.signal,
        })
        ctx.publish('game', await res.json())
      } catch (err) {
        ctx.log(`fetch failed: ${err}`)
      }
    }
    const interval = setInterval(poll, 5000)
    void poll()
    return () => clearInterval(interval)
  },
})

export default definePackage({
  id: 'drexel-basketball',
  name: 'Drexel Basketball',
  version: '1.0.0',
  data: { game: GameState },
  providers: [scoreProvider],
  templates: [/* ... */],
})
```

`ProviderContext` (passed to `start`):

| Member | Purpose |
|--------|---------|
| `config` | Always-current package config for this rundown (live getter, no restart needed to read new values) |
| `publish(key, value)` | Full replace of a declared data key (validated against `data[key]`) |
| `patch(key, patch)` | Deep-merge into the current value |
| `dataset(id)` | Read a cached dataset (see below); triggers a background fetch if not yet loaded |
| `log(message)` | Appended to the provider's log ring buffer (`GET /api/control/rundowns/:id/providers`) |
| `setStatus({ state, message })` | Manually report `ok` / `error` / etc |
| `signal` | Aborts on stop/detach/config-restart — cancel fetches, exit loops |

**Crash isolation:** a thrown error inside `start` (sync or async) is caught,
logged, and the provider is retried with exponential backoff (1s → 30s cap).
A crashing provider never takes down the control plane. `scope: 'host'`
(default `'rundown'`) is reserved for feeds that should run once regardless of
how many rundowns attach the package — not yet implemented; today every
provider is rundown-scoped.

`autostart` (default `true`) starts the provider when the package is
attached. `restartOnConfigChange` (default `true`) stops + restarts running
providers when `rundown.patchConfig` / `rundown.replaceConfig` fires — set to
`false` if the provider already reads `ctx.config` live and doesn't need a
restart.

## Authoring: binding live data onto props

```ts
defineTemplate({
  id: 'scorebug',
  schema: ScorebugProps,
  defaults: { homeScore: 0, awayScore: 0, clockLabel: '00:00' },
  live: {
    bind: {
      homeScore: 'data.game.homeScore',
      awayScore: 'data.game.awayScore',
      'clock.label': 'data.game.clockMs', // dotted prop paths supported
      teamName: 'config.homeTeam',
    },
  },
  Render: () => import('./Graphic'),
})
```

Source paths read from `{ data: <rundown's live-data keys for this package>,
config: <the rundown's package config> }`. The projector recomputes whenever
data changes, config changes, or the instance set changes; the merged result
is validated against the template's schema before being written to the
overlay — an invalid merge is dropped (logged), never corrupts the instance.

**Known limitation:** only declarative `bind` (dotted paths) is implemented.
A `select` escape hatch (arbitrary server-side function) and pinning a
live-bound prop back to a manual value (`instances.live_overrides`) are
described in the design but not built yet — an operator edit to a live-bound
field will be overwritten by the next projector tick.

## Datasets

```ts
definePackage({
  // ...
  datasets: [{ id: 'teams', url: 'https://example.com/teams.json', ttlMs: 60 * 60 * 1000 }],
})
```

Fetched lazily (first `ctx.dataset('teams')` call or `GET
/api/control/datasets/:packageId/teams`), cached in memory + on disk under
`data/cache/<packageId>/<id>.json`, revalidated after `ttlMs` (default 1h),
falling back to the last-known-good copy (memory, then disk) on fetch failure.

## Worked example

[`examples/hgfx-package-example`](../examples/hgfx-package-example) wires up
all four pieces end to end (`src/live-data.ts` + `src/index.ts` +
`src/templates/ticker/schema.ts`): a `prefix` config field, a `ticker` data
key, a `defineProvider` that republishes a rotating headline every 4s using
the live `ctx.config.prefix`, and `live.bind: { message: 'data.ticker.message' }`
on the GSAP ticker template. Build it (`bun run build` from that folder) and
attach `example-pkg` to a rundown with a ticker instance to see it update
live from the PACKAGES tab.

## Where this lives

| Concern | File |
|---------|------|
| Wire protocol | [`src/control/protocol.ts`](../src/control/protocol.ts) — `rundown.attachPackage` / `detachPackage` / `patchConfig` / `replaceConfig`, `data.publish` / `data.clear`, events `rundown.package` / `data.changed` / `provider.status` |
| Package attachment + ephemeral data + live overlay | [`src/control/server/store.ts`](../src/control/server/store.ts) |
| Command handlers | [`src/control/server/commands.ts`](../src/control/server/commands.ts) |
| Projection (`live.bind` → overlay) | [`src/control/server/projector.ts`](../src/control/server/projector.ts) |
| In-process provider runner | [`src/control/server/providers.ts`](../src/control/server/providers.ts) |
| Dataset cache | [`src/control/server/datasets.ts`](../src/control/server/datasets.ts) |
| SDK surface | [`packages/gfx-sdk/src/index.ts`](../packages/gfx-sdk/src/index.ts) (`defineProvider`, `definePackage` config/data/datasets/providers) |
| Shared types | [`packages/gfx-runtime/src/types.ts`](../packages/gfx-runtime/src/types.ts) (`ProviderContext`, `ProviderDefinition`, `PackageConfigDef`, `TemplateLiveBinding`) |
| Rundown UI | [`src/routes/control/$rundownId/packages.tsx`](../src/routes/control/$rundownId/packages.tsx) — attach/detach, generic config form, provider status, live-data inspector |

## Follow-ups

- `select` bindings + pinning (`live_overrides`) — see limitation above.
- Custom package panels (`panels` in `definePackage`) — today the PACKAGES tab
  is a generic config form; a package can't yet ship its own React panel.
- Provider hot-reload on package re-upload — restart via detach/re-attach or
  a server restart for now.
- `scope: 'host'` providers (one instance shared across rundowns) — declared
  in the type, not implemented.
- Server-authoritative host clock provider — not built; scorebug clocks still
  run client-side (`src/routes/graphics/drexel/store.ts`).
