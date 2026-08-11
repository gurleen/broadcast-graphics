/**
 * Prepare desktop assets for Tauri: Vite build + Bun sidecar compile.
 * Used as beforeDevCommand / beforeBuildCommand.
 */
import { $ } from 'bun'

const skipUi = process.env.SKIP_UI_BUILD === '1'

if (!skipUi) {
  console.log('[prepare:desktop] building UI packages…')
  await $`bun run build:ui`
} else {
  console.log('[prepare:desktop] SKIP_UI_BUILD=1 — skipping UI packages')
}

console.log('[prepare:desktop] vite build…')
await $`bunx vite build`

console.log('[prepare:desktop] writing desktop index.html…')
await $`bun run scripts/write-desktop-index.ts`

console.log('[prepare:desktop] compiling Bun sidecar…')
await $`bun run scripts/build-sidecar.ts`

console.log('[prepare:desktop] ready')
