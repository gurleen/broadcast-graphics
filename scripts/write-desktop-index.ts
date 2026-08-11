/**
 * Write dist/client/index.html from the Start document shell for /control.
 * Desktop sidecar serves this for all client routes (SPA fallback).
 */
import path from 'node:path'
import { mkdir } from 'node:fs/promises'

const root = path.resolve(import.meta.dir, '..')
const serverEntry = path.join(root, 'dist', 'server', 'server.js')
const outDir = path.join(root, 'dist', 'client')
const outFile = path.join(outDir, 'index.html')

const mod = (await import(serverEntry)) as {
  default: { fetch: (request: Request) => Response | Promise<Response> }
}

const response = await mod.default.fetch(new Request('http://127.0.0.1/control'))
if (!response.ok) {
  console.error(`[write-desktop-index] unexpected status ${response.status}`)
  process.exit(1)
}

const html = (await response.text()).replaceAll('\0', '')
await mkdir(outDir, { recursive: true })
await Bun.write(outFile, html)
console.log(`[write-desktop-index] wrote ${outFile} (${html.length} bytes)`)
