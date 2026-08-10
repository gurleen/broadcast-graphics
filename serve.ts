/**
 * Production server for TanStack Start on Bun (no Nitro).
 * Build first: `bun run build` → `dist/client` + `dist/server/server.js`
 *
 * Also mounts the Hono control plane at `/api/control` (REST + WebSocket).
 */
import path from 'node:path'
import { app as controlApp, websocket as controlWebsocket } from './server/app'

const PORT = Number(process.env.PORT ?? 3000)
const CLIENT_DIR = './dist/client'
const SERVER_ENTRY = './dist/server/server.js'

async function loadAppHandler() {
  const mod = (await import(SERVER_ENTRY)) as {
    default: { fetch: (request: Request) => Response | Promise<Response> }
  }
  return mod.default
}

async function main() {
  const app = await loadAppHandler()

  const staticGlob = new Bun.Glob('**/*')
  const staticRoutes: Record<string, () => Response> = {}

  for await (const relativePath of staticGlob.scan({ cwd: CLIENT_DIR })) {
    const filepath = path.join(CLIENT_DIR, relativePath)
    const file = Bun.file(filepath)
    if (!(await file.exists()) || file.size === 0) continue
    const route = `/${relativePath.split(path.sep).join('/')}`
    staticRoutes[route] = () =>
      new Response(file, {
        headers: {
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
  }

  Bun.serve({
    port: PORT,
    fetch(request, server) {
      const url = new URL(request.url)

      if (url.pathname.startsWith('/api/control')) {
        return controlApp.fetch(request, server)
      }

      const staticHandler = staticRoutes[url.pathname]
      if (staticHandler) return staticHandler()

      return app.fetch(request)
    },
    websocket: controlWebsocket,
  })

  console.log(`[broadcast-graphics] http://localhost:${PORT}`)
  console.log(`[broadcast-graphics] control plane at /api/control`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
