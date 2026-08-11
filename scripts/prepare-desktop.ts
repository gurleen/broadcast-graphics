/**
 * Prepare desktop assets for Tauri: Vite build + Bun sidecar compile.
 * Used as beforeDevCommand / beforeBuildCommand.
 */
import { $ } from 'bun'

console.log('[prepare:desktop] vite build…')
await $`bunx vite build`

console.log('[prepare:desktop] writing desktop index.html…')
await $`bun run scripts/write-desktop-index.ts`

console.log('[prepare:desktop] compiling Bun sidecar…')
await $`bun run scripts/build-sidecar.ts`

console.log('[prepare:desktop] ready')
