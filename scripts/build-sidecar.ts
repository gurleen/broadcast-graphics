/**
 * Compile serve-desktop.ts to a Tauri externalBin sidecar with the host target triple.
 *
 * Output: src-tauri/binaries/broadcast-server-<rustc host triple>
 */
import { $ } from 'bun'
import path from 'node:path'
import { mkdir } from 'node:fs/promises'

const root = path.resolve(import.meta.dir, '..')
const binariesDir = path.join(root, 'src-tauri', 'binaries')
await mkdir(binariesDir, { recursive: true })

const triple = (await $`rustc --print host-tuple`.text()).trim()
if (!triple) {
  console.error('Failed to determine rustc host tuple')
  process.exit(1)
}

const outfile = path.join(binariesDir, `broadcast-server-${triple}`)
console.log(`[build:sidecar] compiling → ${outfile}`)

const result = await $`bun build --compile --outfile=${outfile} ${path.join(root, 'serve-desktop.ts')}`.nothrow()
if (result.exitCode !== 0) {
  console.error(result.stderr.toString() || result.stdout.toString())
  process.exit(result.exitCode ?? 1)
}

console.log(`[build:sidecar] done (${triple})`)
