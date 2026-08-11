/**
 * Bun-side shared module registry for importing `.hgfx.js` artifacts to read schemas.
 * Browser-only modules are lazy Proxy stubs so schema evaluation never touches the DOM.
 */
import * as React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import * as zod from 'zod'
import * as gfxRuntime from '@hydra-tv/hydra-gfx-runtime'
import { installRuntime, RUNTIME_VERSION, type SharedModules } from './runtime-shared'

function lazyStub(label: string): unknown {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === '__esModule') return true
      if (prop === 'default') {
        return new Proxy(function stubDefault() {}, handler)
      }
      if (prop === Symbol.toStringTag) return 'Module'
      if (typeof prop === 'symbol') return undefined
      // Common React component / hook names: return a no-op function or nested proxy
      if (prop === 'createElement' || prop === 'Fragment' || prop === 'jsx' || prop === 'jsxs') {
        return () => null
      }
      if (typeof prop === 'string' && (prop.startsWith('use') || /^[A-Z]/.test(prop))) {
        return new Proxy(function stubExport() {
          return null
        }, handler)
      }
      return new Proxy(function nested() {
        return null
      }, handler)
    },
    apply() {
      return null
    },
    construct() {
      return {}
    },
  }
  return new Proxy({ [Symbol.toStringTag]: label }, handler)
}

export function buildServerSharedModules(): SharedModules {
  return {
    react: React,
    'react/jsx-runtime': jsxRuntime,
    'react/jsx-dev-runtime': jsxRuntime,
    zod,
    '@hydra-tv/hydra-gfx-runtime': gfxRuntime,
    // Browser / UI modules — never evaluated for schema imports when components are lazy.
    'motion/react': lazyStub('motion/react'),
    '@gurleen-ui/core': lazyStub('@gurleen-ui/core'),
    '@gurleen-ui/broadcast': lazyStub('@gurleen-ui/broadcast'),
  }
}

export function installServerRuntime() {
  if (globalThis.__HYDRA_GFX_RUNTIME__) return globalThis.__HYDRA_GFX_RUNTIME__
  return installRuntime(buildServerSharedModules(), RUNTIME_VERSION)
}
