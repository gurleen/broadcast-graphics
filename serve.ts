/**
 * Production server for TanStack Start on Bun (no Nitro).
 * Build first: `bun run build` → `dist/client` + `dist/server/server.js`
 */
import path from 'node:path'

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
    fetch(request) {
      const url = new URL(request.url)

      const staticHandler = staticRoutes[url.pathname]
      if (staticHandler) return staticHandler()

      return app.fetch(request)
    },
  })

  console.log(`[broadcast-graphics] http://localhost:${PORT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
