/**
 * Browser-side shared module registry for dynamic template packages.
 */
import * as React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import * as jsxDevRuntime from 'react/jsx-dev-runtime'
import * as motion from 'motion/react'
import * as zod from 'zod'
import * as gurleenCore from '@gurleen-ui/core'
import * as gurleenBroadcast from '@gurleen-ui/broadcast'
import * as gfxRuntime from '@hydra-tv/hydra-gfx-runtime'
import {
  DEFAULT_SHARED,
  installRuntime,
  RUNTIME_VERSION,
  type SharedModules,
} from './runtime-shared'

export {
  DEFAULT_SHARED,
  MANDATORY_SHARED,
  RUNTIME_VERSION,
  RUNTIME_GLOBAL_KEY,
  getInstalledRuntime,
  type HydraGfxRuntime,
} from './runtime-shared'

export function buildClientSharedModules(): SharedModules {
  return {
    react: React,
    'react/jsx-runtime': jsxRuntime,
    'react/jsx-dev-runtime': jsxDevRuntime,
    'motion/react': motion,
    zod,
    '@gurleen-ui/core': gurleenCore,
    '@gurleen-ui/broadcast': gurleenBroadcast,
    '@hydra-tv/hydra-gfx-runtime': gfxRuntime,
  }
}

/** Idempotent — safe to call from multiple entry points. */
export function installClientRuntime() {
  if (globalThis.__HYDRA_GFX_RUNTIME__) return globalThis.__HYDRA_GFX_RUNTIME__
  return installRuntime(buildClientSharedModules(), RUNTIME_VERSION)
}

/** Contract published to the SDK so package builds fail fast on unknown shared ids. */
export function runtimeContract(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const id of DEFAULT_SHARED) {
    out[id] = RUNTIME_VERSION
  }
  return out
}
