#!/usr/bin/env bun
/**
 * hydra-gfx — build a graphics package into a single-file `.hgfx.js` artifact.
 *
 * Usage:
 *   bun run hydra-gfx build [--watch] [--out <dir>] [--config <path>]
 */
import { mkdir, readFile, writeFile, rm, mkdtemp } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { watch } from 'node:fs'
import {
  buildManifest,
  enumerateExports,
  generateShimSource,
  resolveShared,
  type HydraConfig,
} from './config'
import type { DefinedPackage } from './index'
import { FORMAT_VERSION } from './index'

const ROOT = process.cwd()

async function loadConfig(configPath: string): Promise<HydraConfig> {
  const abs = path.resolve(ROOT, configPath)
  const mod = (await import(abs)) as { default?: HydraConfig } & HydraConfig
  return (mod.default ?? mod) as HydraConfig
}

async function loadContract(): Promise<Record<string, string>> {
  const candidates = [
    path.resolve(import.meta.dir, '../runtime-contract.json'),
    path.resolve(ROOT, 'node_modules/@hydra-tv/hydra-gfx-sdk/runtime-contract.json'),
  ]
  for (const c of candidates) {
    try {
      return JSON.parse(await readFile(c, 'utf8')) as Record<string, string>
    } catch {
      // try next
    }
  }
  // Fallback to defaults baked into the SDK
  return {
    react: '0.1.0',
    'react/jsx-runtime': '0.1.0',
    'react/jsx-dev-runtime': '0.1.0',
    '@hydra-tv/hydra-gfx-runtime': '0.1.0',
    'motion/react': '0.1.0',
    zod: '0.1.0',
    '@gurleen-ui/core': '0.1.0',
    '@gurleen-ui/broadcast': '0.1.0',
  }
}

async function writeShims(shimDir: string, shared: string[]): Promise<Map<string, string>> {
  await mkdir(shimDir, { recursive: true })
  const map = new Map<string, string>()
  for (const specifier of shared) {
    let exportNames: string[]
    try {
      exportNames = await enumerateExports(specifier)
    } catch (err) {
      console.warn(`[hydra-gfx] could not enumerate exports for ${specifier}, using default only:`, err)
      exportNames = ['default']
    }
    const file = path.join(shimDir, `${createHash('sha1').update(specifier).digest('hex')}.js`)
    await writeFile(file, generateShimSource(specifier, exportNames))
    map.set(specifier, file)
  }
  return map
}

async function buildOnce(opts: {
  configPath: string
  outDir: string
}): Promise<{ outFile: string; bytes: number }> {
  const config = await loadConfig(opts.configPath)
  const contract = await loadContract()
  const shared = resolveShared(config, contract)
  const entry = path.resolve(ROOT, config.entry ?? 'src/index.ts')
  const outDir = path.resolve(ROOT, opts.outDir || config.outDir || 'dist')
  await mkdir(outDir, { recursive: true })

  const tmp = await mkdtemp(path.join(outDir, '.hgfx-build-'))
  const shimDir = path.join(tmp, 'shims')
  const shimMap = await writeShims(shimDir, shared)

  // Install a minimal runtime so importing the built artifact for manifest works.
  // The CLI itself doesn't need UI modules — only schemas.
  const { installServerRuntime } = await import(
    /* @vite-ignore */ pathToHostRuntimeServer()
  ).catch(async () => {
    // When building from a package repo without the host, install a light registry.
    const React = await import('react')
    const jsx = await import('react/jsx-runtime')
    const zod = await import('zod')
    ;(globalThis as { __HYDRA_GFX_RUNTIME__?: unknown }).__HYDRA_GFX_RUNTIME__ = {
      version: '0.1.0',
      require(id: string) {
        if (id === 'react') return React
        if (id === 'react/jsx-runtime' || id === 'react/jsx-dev-runtime') return jsx
        if (id === 'zod') return zod
        return new Proxy({}, { get: () => () => null })
      },
      has() {
        return true
      },
      keys() {
        return shared
      },
    }
    return {}
  })
  if (typeof installServerRuntime === 'function') installServerRuntime()

  const result = await Bun.build({
    entrypoints: [entry],
    outdir: tmp,
    target: 'browser',
    format: 'esm',
    splitting: false,
    minify: false,
    sourcemap: 'none',
    naming: 'bundle.js',
    external: [],
    plugins: [
      {
        name: 'hydra-shared-shims',
        setup(build) {
          const filter = new RegExp(
            `^(${shared.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`,
          )
          build.onResolve({ filter }, (args) => {
            const shim = shimMap.get(args.path)
            if (!shim) return null
            return { path: shim }
          })
        },
      },
    ],
    loader: {
      '.png': 'dataurl',
      '.jpg': 'dataurl',
      '.jpeg': 'dataurl',
      '.gif': 'dataurl',
      '.svg': 'dataurl',
      '.webp': 'dataurl',
      '.woff': 'dataurl',
      '.woff2': 'dataurl',
      '.ttf': 'dataurl',
      '.otf': 'dataurl',
      '.css': 'text',
      // Bun's Loader typings lag behind supported asset loaders used at build time.
    } as unknown as Bun.BuildConfig['loader'],
  })

  if (!result.success) {
    const msgs = result.logs.map((l) => l.message ?? String(l)).join('\n')
    await rm(tmp, { recursive: true, force: true })
    throw new Error(`Bun.build failed:\n${msgs}`)
  }

  const builtPath = path.join(tmp, 'bundle.js')
  let bundleCode = await readFile(builtPath, 'utf8')

  // Import the artifact with the runtime installed to extract definePackage + schemas.
  // Write a temporary copy first so Bun can import it.
  const importPath = path.join(tmp, 'importable.js')
  await writeFile(importPath, bundleCode)
  const mod = (await import(importPath + `?t=${Date.now()}`)) as {
    default: DefinedPackage
    manifest?: unknown
  }
  const pkg = mod.default
  if (!pkg?.id || !pkg.templates) {
    await rm(tmp, { recursive: true, force: true })
    throw new Error('Package entry must default-export definePackage({...})')
  }

  const runtimeRange = config.runtime ?? `^${FORMAT_VERSION}.0.0`
  const manifest = await buildManifest(pkg, runtimeRange)

  // Prepend / replace: ensure `export const manifest` and `export default` exist.
  // Bun.build already exports default from the entry. Append manifest export.
  if (!/\bexport\s+const\s+manifest\b/.test(bundleCode)) {
    bundleCode += `\nexport const manifest = ${JSON.stringify(manifest, null, 2)};\n`
  }

  const outFile = path.join(outDir, `${pkg.id}.hgfx.js`)
  await writeFile(outFile, bundleCode)
  const bytes = Buffer.byteLength(bundleCode)

  // Size report: rough — shared modules aren't in the file; report artifact size.
  console.log(`[hydra-gfx] built ${path.relative(ROOT, outFile)} (${formatBytes(bytes)})`)
  console.log(`[hydra-gfx] package ${pkg.id}@${pkg.version} — ${pkg.templates.length} template(s)`)
  console.log(`[hydra-gfx] shared: ${shared.join(', ')}`)

  await rm(tmp, { recursive: true, force: true })
  return { outFile, bytes }
}

function pathToHostRuntimeServer(): string {
  // Prefer resolving from a monorepo host checkout
  const candidates = [
    path.resolve(ROOT, '../../src/packages/runtime.server.ts'),
    path.resolve(ROOT, '../src/packages/runtime.server.ts'),
    path.resolve(ROOT, 'src/packages/runtime.server.ts'),
  ]
  for (const c of candidates) {
    try {
      if (Bun.file(c).size >= 0) return c
    } catch {
      // continue
    }
  }
  return candidates[0]!
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

async function main() {
  const args = process.argv.slice(2)
  const cmd = args[0] ?? 'build'
  if (cmd !== 'build') {
    console.error(`Unknown command: ${cmd}\nUsage: hydra-gfx build [--watch] [--out <dir>] [--config <path>]`)
    process.exit(1)
  }

  let configPath = 'hydra.config.ts'
  let outDir = ''
  let watchMode = false
  for (let i = 1; i < args.length; i++) {
    const a = args[i]!
    if (a === '--watch') watchMode = true
    else if (a === '--out') outDir = args[++i] ?? ''
    else if (a === '--config') configPath = args[++i] ?? configPath
    else if (a.startsWith('--out=')) outDir = a.slice(6)
    else if (a.startsWith('--config=')) configPath = a.slice(9)
  }

  const config = await loadConfig(configPath)
  const resolvedOut = outDir || config.outDir || 'dist'

  const run = async () => {
    try {
      await buildOnce({ configPath, outDir: resolvedOut })
    } catch (err) {
      console.error('[hydra-gfx] build failed:', err)
      if (!watchMode) process.exit(1)
    }
  }

  await run()

  if (watchMode) {
    const watchRoot = path.resolve(ROOT, 'src')
    console.log(`[hydra-gfx] watching ${watchRoot}`)
    let timer: ReturnType<typeof setTimeout> | null = null
    watch(watchRoot, { recursive: true }, () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => void run(), 150)
    })
  }
}

main()
