/**
 * Dev entry: Bun on :3000 fronting Vite on :5173.
 *
 * WebSocket upgrades (Vite HMR, TanStack devtools, etc.) are proxied to Vite
 * by opening an outbound WebSocket and piping frames both ways. Plain HTTP
 * requests are forwarded with `fetch()`.
 */
import { createServer as createViteServer } from 'vite'

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
  },
})

await vite.listen()
vite.printUrls()

type ViteProxyConn = {
  targetUrl: string
  protocol: string | undefined
  upstream: WebSocket | null
  queue: (string | BufferSource)[]
}

Bun.serve<ViteProxyConn, object>({
  port: PUBLIC_PORT,
  fetch(request, server) {
    const url = new URL(request.url)

    if (request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
      const data: ViteProxyConn = {
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
    },
    message(ws, message) {
      const data = ws.data
      const payload: string | BufferSource =
        typeof message === 'string' ? message : new Uint8Array(message)
      if (data.upstream && data.upstream.readyState === WebSocket.OPEN) {
        data.upstream.send(payload)
      } else {
        data.queue.push(payload)
      }
    },
    close(ws) {
      ws.data.upstream?.close()
    },
  },
})

console.log(`[broadcast-graphics] public http://localhost:${PUBLIC_PORT} → vite ${VITE_ORIGIN}`)
