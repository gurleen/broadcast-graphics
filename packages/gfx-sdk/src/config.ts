import type { FieldDef } from '@hydra-tv/hydra-gfx-runtime/types'
import type { DefinedPackage, PackageManifest } from './index'
import { FORMAT_VERSION } from './index'

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

export type HydraConfig = {
  /** Package entry that default-exports definePackage(...). */
  entry?: string
  outDir?: string
  shared?: string[]
  /** Semver range the host runtime must satisfy. */
  runtime?: string
}

export function resolveShared(config: HydraConfig, contract: Record<string, string>): string[] {
  const requested = [...(config.shared ?? DEFAULT_SHARED)]
  for (const id of MANDATORY_SHARED) {
    if (!requested.includes(id)) requested.push(id)
  }
  const unknown = requested.filter((id) => !(id in contract))
  if (unknown.length) {
    throw new Error(
      `hydra.config shared includes unsupported modules: ${unknown.join(', ')}\n` +
        `Host contract provides: ${Object.keys(contract).join(', ')}`,
    )
  }
  return [...new Set(requested)]
}

const RESERVED = new Set([
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'implements',
  'import',
  'in',
  'instanceof',
  'interface',
  'let',
  'new',
  'null',
  'package',
  'private',
  'protected',
  'public',
  'return',
  'static',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
])

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/

async function resolveModuleUrl(specifier: string): Promise<string> {
  try {
    // Prefer Bun's resolver to get the real JS entry (not .d.ts).
    const resolved = Bun.resolveSync(specifier, process.cwd())
    if (resolved.endsWith('.d.ts') || resolved.endsWith('.d.cts')) {
      const js = resolved.replace(/\.d\.cts$/, '.cjs').replace(/\.d\.ts$/, '.js')
      return js
    }
    return resolved
  } catch {
    return specifier
  }
}

export async function enumerateExports(specifier: string): Promise<string[]> {
  const url = await resolveModuleUrl(specifier)
  const ns = (await import(url)) as Record<string, unknown>
  return Object.keys(ns).filter(
    (k) => k !== '__esModule' && IDENT.test(k) && !RESERVED.has(k),
  )
}

export function generateShimSource(specifier: string, exportNames: string[]): string {
  const lines = [
    `const __ns = globalThis.__HYDRA_GFX_RUNTIME__.require(${JSON.stringify(specifier)});`,
  ]
  const named = exportNames.filter((n) => n !== 'default')
  for (const name of named) {
    lines.push(`export const ${name} = __ns[${JSON.stringify(name)}];`)
  }
  lines.push(`export default __ns.default ?? __ns;`)
  return lines.join('\n')
}

export async function buildManifest(
  pkg: DefinedPackage,
  runtimeRange: string,
): Promise<PackageManifest> {
  const { z } = await import('zod')
  return {
    formatVersion: FORMAT_VERSION,
    runtime: runtimeRange,
    package: { id: pkg.id, name: pkg.name, version: pkg.version },
    templates: pkg.templates.map((t) => ({
      id: t.id,
      name: t.name,
      defaults: t.defaults as Record<string, unknown>,
      fields: t.fields as PackageManifest['templates'][number]['fields'],
      transition: t.transition,
      live: t.live,
      jsonSchema: z.toJSONSchema(t.schema) as Record<string, unknown>,
    })),
    config: pkg.config
      ? {
          defaults: pkg.config.defaults as Record<string, unknown>,
          fields: pkg.config.fields as Record<string, FieldDef> | undefined,
          jsonSchema: z.toJSONSchema(pkg.config.schema) as Record<string, unknown>,
        }
      : undefined,
    dataKeys: pkg.data
      ? Object.entries(pkg.data).map(([key, schema]) => ({
          key,
          jsonSchema: z.toJSONSchema(schema) as Record<string, unknown>,
        }))
      : undefined,
    datasets: pkg.datasets,
    providers: pkg.providers?.map((p) => ({
      id: p.id,
      name: p.name,
      publishes: p.publishes ?? [],
      scope: p.scope ?? 'rundown',
      autostart: p.autostart ?? true,
    })),
  }
}
