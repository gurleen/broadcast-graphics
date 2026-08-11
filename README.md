Welcome to your new TanStack Start app!

# Getting Started

This repo vendors the [@gurleen-ui](https://github.com/gurleen/ui) component libraries as a git submodule at `ui/`.

To run this application:

```bash
git submodule update --init --recursive   # if you cloned without --recurse-submodules
bun install
bun run dev
```

`predev` and `prebuild` run `build:ui`, which installs and builds the submodule (`npm ci` + `npm run build` inside `ui/`). You can run that step alone with `bun run build:ui` after updating the submodule.

Design tokens from `@gurleen-ui/tokens` are loaded once in [`src/routes/__root.tsx`](src/routes/__root.tsx). Use components via `@gurleen-ui/core` and `@gurleen-ui/broadcast`.

Dev runs `dev-server.ts`: Bun serves on port **3000** (open this URL) and proxies to Vite on 5173. The graphics control plane (REST + WebSocket) is mounted at `/api/control`.

# Building For Production

To build this application for production:

```bash
bun --bun run build
```

## Desktop (Tauri)

The desktop app is a Tauri 2 shell around a compiled Bun sidecar (`serve-desktop.ts`). The sidecar binds **loopback only** on port **4737** and serves the UI + `/api/control`. The Tauri window opens `/`; same-machine OBS can use browser sources against the same server.

**Prerequisites:** Rust (`rustc`/`cargo`), Xcode Command Line Tools (macOS), Bun.

```bash
bun install
bun run tauri:dev      # builds UI + sidecar, then opens the desktop app
bun run tauri:build    # produces a packaged .app / installer
```

Faster iteration when `ui/` packages are already built:

```bash
SKIP_UI_BUILD=1 bun run prepare:desktop
bun run tauri:dev
```

`prepare:desktop` runs a Vite production build, writes a desktop `dist/client/index.html` shell (so the sidecar can SPA-serve `/`, `/control`, `/render/*`, and `/graphics/*` without the SSR runtime), then compiles the Bun sidecar.

**OBS / external renderers (same Mac):**

| Surface | URL |
|---------|-----|
| Control UI | `http://127.0.0.1:4737/control` |
| Composite renderer | `http://127.0.0.1:4737/render/<rundownId>` |
| Graphic template | `http://127.0.0.1:4737/graphics/...` |

Override the port with `PORT` if needed (pass through when launching the app). SQLite lives in the OS app-data directory (`CONTROLLER_DB`), not inside the read-only bundle.

Browser workflows (`bun run dev` / `bun run start`) are unchanged for remote OBS or non-desktop use.

## Graphics control plane

The control server owns rundowns and graphic instances (props + playout intent) in SQLite (`data/controller.db`, overridable via `CONTROLLER_DB`). Renderers and a future control UI sync over WebSocket.

**Full reference:** [docs/control-plane.md](docs/control-plane.md) (architecture, protocol, commands, hooks, templates).

### REST (summary)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/control/health` | Liveness + protocol version |
| `GET` | `/api/control/templates` | Registered templates (defaults, fields, JSON Schema) |
| `GET` | `/api/control/rundowns` | List rundowns |
| `POST` | `/api/control/rundowns` | Create rundown `{ name }` |
| `GET` | `/api/control/rundowns/:id` | Full snapshot (rundown, instances, renderers) |
| `POST` | `/api/control/rundowns/:id/commands` | Apply one command or `{ commands: [...] }` |

Example:

```bash
# Create a rundown and add a lower third
curl -s -X POST localhost:3000/api/control/rundowns -H 'content-type: application/json' -d '{"name":"Show"}'
curl -s -X POST localhost:3000/api/control/rundowns/$ID/commands -H 'content-type: application/json' \
  -d '{"type":"instance.add","templateId":"labor-of-love-lower-third","label":"L3_001"}'
curl -s -X POST localhost:3000/api/control/rundowns/$ID/commands -H 'content-type: application/json' \
  -d '{"type":"playout.in","instanceId":"$INSTANCE_ID"}'
```

Open the graphic as a browser source with control params:

`/graphics/labor-of-love/lower-third?rundown=$ID&instance=$INSTANCE_ID`

Or the composite renderer for a whole rundown:

`/render/$ID`

### WebSocket / hooks (summary)

Connect to `ws(s)://{host}/api/control/ws`, then send:

```json
{ "type": "hello", "role": "control", "rundownId": "...", "protocolVersion": 1 }
```

Client hooks live in `#/control/client`:

- `useRundownController(rundownId)` — API for a future control UI
- `useControlledGraphic(template)` — drop-in for graphic routes (local preview without search params; server-driven with `?rundown=&instance=`)

### Follow-ups

- Control UI (not in this pass)
- Server-authoritative game clocks so multiple browser sources do not drift (scorebug clock is still local `setInterval` today)

Production must be started with Bun (`bun run start`), not Node, because the control plane uses `bun:sqlite`.

## Styling

This project uses [Tailwind CSS](https://tailwindcss.com/) for styling.

### Removing Tailwind CSS

If you prefer not to use Tailwind CSS:

1. Remove the demo pages in `src/routes/demo/`
2. Replace the Tailwind import in `src/styles.css` with your own styles
3. Remove `tailwindcss()` from the plugins array in `vite.config.ts`
4. Remove `@tailwindcss/vite` and `tailwindcss` from `package.json`


## Deploy with Bun

This app uses [TanStack Start](https://tanstack.com/start) with Vite (no Nitro). The SSR entry is `src/server.ts`.

```bash
bun run build
bun run start
```

Production uses `serve.ts` (`Bun.serve`).

## Routing

This project uses [TanStack Router](https://tanstack.com/router) with file-based routing. Routes are managed as files in `src/routes`.

### Adding A Route

To add a new route to your application just add a new file in the `./src/routes` directory.

TanStack will automatically generate the content of the route file for you.

Now that you have two routes you can use a `Link` component to navigate between them.

### Adding Links

To use SPA (Single Page Application) navigation you will need to import the `Link` component from `@tanstack/react-router`.

```tsx
import { Link } from "@tanstack/react-router";
```

Then anywhere in your JSX you can use it like so:

```tsx
<Link to="/about">About</Link>
```

This will create a link that will navigate to the `/about` route.

More information on the `Link` component can be found in the [Link documentation](https://tanstack.com/router/v1/docs/framework/react/api/router/linkComponent).

### Using A Layout

In the File Based Routing setup the layout is located in `src/routes/__root.tsx`. Anything you add to the root route will appear in all the routes. The route content will appear in the JSX where you render `{children}` in the `shellComponent`.

Here is an example layout that includes a header:

```tsx
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'My App' },
    ],
  }),
  shellComponent: ({ children }) => (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <header>
          <nav>
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
          </nav>
        </header>
        {children}
        <Scripts />
      </body>
    </html>
  ),
})
```

More information on layouts can be found in the [Layouts documentation](https://tanstack.com/router/latest/docs/framework/react/guide/routing-concepts#layouts).

## Server Functions

TanStack Start provides server functions that allow you to write server-side code that seamlessly integrates with your client components.

```tsx
import { createServerFn } from '@tanstack/react-start'

const getServerTime = createServerFn({
  method: 'GET',
}).handler(async () => {
  return new Date().toISOString()
})

// Use in a component
function MyComponent() {
  const [time, setTime] = useState('')
  
  useEffect(() => {
    getServerTime().then(setTime)
  }, [])
  
  return <div>Server time: {time}</div>
}
```

## API Routes

You can create API routes by using the `server` property in your route definitions:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

export const Route = createFileRoute('/api/hello')({
  server: {
    handlers: {
      GET: () => json({ message: 'Hello, World!' }),
    },
  },
})
```

## Data Fetching

There are multiple ways to fetch data in your application. You can use TanStack Query to fetch data from a server. But you can also use the `loader` functionality built into TanStack Router to load the data for a route before it's rendered.

For example:

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/people')({
  loader: async () => {
    const response = await fetch('https://swapi.dev/api/people')
    return response.json()
  },
  component: PeopleComponent,
})

function PeopleComponent() {
  const data = Route.useLoaderData()
  return (
    <ul>
      {data.results.map((person) => (
        <li key={person.name}>{person.name}</li>
      ))}
    </ul>
  )
}
```

Loaders simplify your data fetching logic dramatically. Check out more information in the [Loader documentation](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#loader-parameters).



# Learn More

You can learn more about all of the offerings from TanStack in the [TanStack documentation](https://tanstack.com).

For TanStack Start specific documentation, visit [TanStack Start](https://tanstack.com/start).
