/**
 * Host-provided shared-module registry for dynamic `.hgfx.js` packages.
 * Package builds rewrite shared imports to `globalThis.__HYDRA_GFX_RUNTIME__.require(id)`.
 */

export const RUNTIME_GLOBAL_KEY = '__HYDRA_GFX_RUNTIME__' as const

export type HydraGfxRuntime = {
  version: string
  require: (id: string) => unknown
  has: (id: string) => boolean
  keys: () => string[]
}

export type SharedModules = Record<string, unknown>

declare global {
  // eslint-disable-next-line no-var
  var __HYDRA_GFX_RUNTIME__: HydraGfxRuntime | undefined
}

export const RUNTIME_VERSION = '0.1.0'

/** Modules the host always registers. Packages may opt out of non-mandatory ones. */
export const MANDATORY_SHARED = [
  'react',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  '@hydra-tv/hydra-gfx-runtime',
] as const

export const DEFAULT_SHARED = [
  ...MANDATORY_SHARED,
  'motion/react',
  'zod',
  '@hydra-tv/ui',
  '@hydra-tv/broadcast',
] as const

export function installRuntime(modules: SharedModules, version = RUNTIME_VERSION): HydraGfxRuntime {
  const map = new Map<string, unknown>(Object.entries(modules))
  const runtime: HydraGfxRuntime = {
    version,
    require(id: string) {
      if (!map.has(id)) {
        throw new Error(`[hydra-gfx] shared module not registered: ${id}`)
      }
      return map.get(id)
    },
    has(id: string) {
      return map.has(id)
    },
    keys() {
      return [...map.keys()]
    },
  }
  globalThis.__HYDRA_GFX_RUNTIME__ = runtime
  return runtime
}

export function getInstalledRuntime(): HydraGfxRuntime | undefined {
  return globalThis.__HYDRA_GFX_RUNTIME__
}
