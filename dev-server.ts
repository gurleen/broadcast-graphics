/**
 * Dev entry: Bun on :3000 fronting Vite on :5173, plus the Hono control plane.
 *
 * WebSocket upgrades for Vite HMR are proxied (tagged `kind: 'vite-proxy'`).
 * Control-plane WS upgrades (`/api/control/ws`) go through Hono's handler.
 */
import { createServer as createViteServer } from 'vite'
import { app as controlApp, websocket as controlWebsocket } from './server/app'

const PUBLIC_PORT = Number(process.env.PORT ?? 3000)
const VITE_PORT = Number(process.env.VITE_DEV_PORT ?? 5173)
const VITE_ORIGIN = `http://127.0.0.1:${VITE_PORT}`
const VITE_WS_ORIGIN = `ws://127.0.0.1:${VITE_PORT}`

const vite = await createViteServer({
  configFile: 'vite.config.ts',
  server: {
    host: '127.0.0.1',
    port: VITE_PORT,
    strictPort: true,
    // If someone opens Vite's port directly, forward control-plane REST/WS to Bun.
    proxy: {
      '/api/control': {
        target: `http://127.0.0.1:${PUBLIC_PORT}`,
        changeOrigin: true,
        ws: true,
      },
    },
  },
})

await vite.listen()

type ViteProxyConn = {
  kind: 'vite-proxy'
  targetUrl: string
  protocol: string | undefined
  upstream: WebSocket | null
  queue: (string | BufferSource)[]
}

type WsData = ViteProxyConn | { events: unknown; url: URL; protocol: string }

function isViteProxy(data: WsData): data is ViteProxyConn {
  return (data as ViteProxyConn).kind === 'vite-proxy'
}

Bun.serve<WsData, object>({
  port: PUBLIC_PORT,
  fetch(request, server) {
    const url = new URL(request.url)

    // Control plane (REST + WS upgrade) — pass the Bun server as env so
    // hono/bun's upgradeWebSocket can call server.upgrade().
    if (url.pathname.startsWith('/api/control')) {
      return controlApp.fetch(request, server)
    }

    if (request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
      const data: ViteProxyConn = {
        kind: 'vite-proxy',
        targetUrl: `${VITE_WS_ORIGIN}${url.pathname}${url.search}`,
        protocol: request.headers.get('sec-websocket-protocol') ?? undefined,
        upstream: null,
        queue: [],
      }
      const upgraded = server.upgrade(request, { data })
      return upgraded ? undefined : new Response('WebSocket upgrade failed', { status: 500 })
    }

    const target = new URL(url.pathname + url.search, VITE_ORIGIN)
    return fetch(new Request(target, request))
  },
  websocket: {
    open(ws) {
      if (isViteProxy(ws.data)) {
        const data = ws.data
        const upstream = new WebSocket(data.targetUrl, data.protocol)
        upstream.binaryType = 'arraybuffer'
        data.upstream = upstream

        upstream.onopen = () => {
          for (const message of data.queue) upstream.send(message)
          data.queue.length = 0
        }
        upstream.onmessage = (event) => {
          ws.send(event.data as string | ArrayBuffer)
        }
        upstream.onclose = (event) => {
          ws.close(event.code, event.reason)
        }
        upstream.onerror = () => {
          ws.close(1011, 'Upstream WebSocket error')
        }
        return
      }
      controlWebsocket.open(ws as never)
    },
    message(ws, message) {
      if (isViteProxy(ws.data)) {
        const data = ws.data
        const payload: string | BufferSource =
          typeof message === 'string' ? message : new Uint8Array(message)
        if (data.upstream && data.upstream.readyState === WebSocket.OPEN) {
          data.upstream.send(payload)
        } else {
          data.queue.push(payload)
        }
        return
      }
      controlWebsocket.message(ws as never, message as never)
    },
    close(ws, code, reason) {
      if (isViteProxy(ws.data)) {
        ws.data.upstream?.close()
        return
      }
      controlWebsocket.close(ws as never, code, reason)
    },
  },
})

console.log(`[broadcast-graphics] open http://localhost:${PUBLIC_PORT}`)
console.log(`[broadcast-graphics] control plane at /api/control (vite :${VITE_PORT} is internal)`)
