/**
 * Desktop sidecar server for Tauri.
 *
 * Serves dist/client statically (SPA), mounts /api/control, binds loopback :4737.
 * Does not load dist/server — requires dist/client/index.html from write-desktop-index.
 */
import path from 'node:path'
import { app as controlApp, websocket as controlWebsocket } from './server/app'

const HOST = '127.0.0.1'
const PORT = Number(process.env.PORT ?? 4737)
const APP_ROOT = path.resolve(process.env.APP_ROOT ?? process.cwd())
const CLIENT_DIR = path.join(APP_ROOT, 'dist', 'client')

function contentTypeFor(filePath: string): string | undefined {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case '.html':
      return 'text/html; charset=utf-8'
    case '.js':
      return 'text/javascript; charset=utf-8'
    case '.css':
      return 'text/css; charset=utf-8'
    case '.json':
      return 'application/json'
    case '.svg':
      return 'image/svg+xml'
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.woff':
      return 'font/woff'
    case '.woff2':
      return 'font/woff2'
    case '.ttf':
      return 'font/ttf'
    case '.webp':
      return 'image/webp'
    default:
      return undefined
  }
}

async function main() {
  const indexFile = Bun.file(path.join(CLIENT_DIR, 'index.html'))
  if (!(await indexFile.exists())) {
    throw new Error(
      `Missing ${path.join(CLIENT_DIR, 'index.html')}. Run: bun run prepare:desktop`,
    )
  }

  const staticGlob = new Bun.Glob('**/*')
  const staticRoutes: Record<string, () => Response> = {}

  for await (const relativePath of staticGlob.scan({ cwd: CLIENT_DIR })) {
    const filepath = path.join(CLIENT_DIR, relativePath)
    const file = Bun.file(filepath)
    if (!(await file.exists()) || file.size === 0) continue
    const route = `/${relativePath.split(path.sep).join('/')}`
    const type = contentTypeFor(filepath)
    staticRoutes[route] = () =>
      new Response(file, {
        headers: {
          ...(type ? { 'Content-Type': type } : {}),
          'Cache-Control':
            route === '/index.html'
              ? 'no-cache'
              : 'public, max-age=31536000, immutable',
        },
      })
  }

  const spaFallback = () =>
    new Response(indexFile, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    })

  const server = Bun.serve({
    hostname: HOST,
    port: PORT,
    fetch(request, bunServer) {
      const url = new URL(request.url)

      if (url.pathname.startsWith('/api/control')) {
        return controlApp.fetch(request, bunServer)
      }

      if (url.pathname === '/') {
        return spaFallback()
      }

      const staticHandler = staticRoutes[url.pathname]
      if (staticHandler) return staticHandler()

      // Client routes: /control, /render/*, /graphics/*
      if (!path.extname(url.pathname)) {
        return spaFallback()
      }

      return new Response('Not Found', { status: 404 })
    },
    websocket: controlWebsocket,
  })

  const origin = `http://${HOST}:${server.port}`
  console.log(`[broadcast-graphics] ${origin}`)
  console.log(`[broadcast-graphics] control plane at /api/control`)
  console.log(`[broadcast-graphics] APP_ROOT=${APP_ROOT}`)
  console.log(`READY ${origin}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
