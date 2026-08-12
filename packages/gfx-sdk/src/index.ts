import type { ComponentType } from 'react'
import type { z } from 'zod'
import type {
  DatasetDeclaration,
  FieldDef,
  PackageConfigDef,
  PackagePanelProps,
  ProviderDefinition,
  TemplateControlsProps,
  TemplateLiveBinding,
  TemplateRenderProps,
  TemplateTransition,
} from '@hydra-tv/hydra-gfx-runtime/types'

export const FORMAT_VERSION = 1 as const

export type ComponentFactory<TProps> =
  | (() => Promise<{ default: ComponentType<TProps> } | ComponentType<TProps> | { [key: string]: unknown }>)
  | (() => Promise<unknown>)

export type DefineTemplateInput<TProps extends Record<string, unknown>> = {
  id: string
  name: string
  schema: z.ZodType<TProps>
  defaults: TProps
  fields?: { [K in keyof TProps & string]?: FieldDef }
  transition?: TemplateTransition
  /** Bind props to rundown-level live data / package config (see `data` below). */
  live?: TemplateLiveBinding
  /** Lazy factory — keep DOM libraries out of the server import graph. */
  Render: ComponentFactory<TemplateRenderProps<TProps>>
  Controls?: ComponentFactory<TemplateControlsProps<TProps>>
  PreviewControls?: ComponentFactory<TemplateControlsProps<TProps>>
}

export type { PackageConfigDef, DatasetDeclaration, ProviderDefinition } from '@hydra-tv/hydra-gfx-runtime/types'
export type {
  ProviderContext,
  ProviderState,
  ProviderStatus,
  PackagePanelProps,
  PackagePanelLiveDatum,
} from '@hydra-tv/hydra-gfx-runtime/types'

export type DefinedTemplate<TProps extends Record<string, unknown> = Record<string, unknown>> =
  DefineTemplateInput<TProps> & {
    /** Filled by the host when the package is installed. */
    route?: string
    packageId?: string
  }

/** A package-registered rundown tab panel (lazy factory, like template Controls). */
export type PackagePanelDef<TConfig extends Record<string, unknown> = Record<string, unknown>> = {
  id: string
  /** Tab label shown in the rundown shell (e.g. `EXAMPLE`). */
  label: string
  Panel: ComponentFactory<PackagePanelProps<TConfig>>
}

export type DefinePackageInput = {
  id: string
  name: string
  version: string
  /** Package-level operator config (sport, home/away team, season, ...). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config?: PackageConfigDef<any>
  /** Rundown-scoped live-data keys this package reads/writes, keyed by name. */
  data?: Record<string, z.ZodType<unknown>>
  /** Remote reference data Hydra should fetch + cache (teams, rosters, ...). */
  datasets?: DatasetDeclaration[]
  /** In-process live-data feeds shipped alongside the package. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  providers?: ProviderDefinition<any>[]
  /**
   * Control panels registered as top-level rundown tabs when this package is
   * attached. Manifest only carries id/label; Panel is resolved in the browser.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  panels?: PackagePanelDef<any>[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  templates: DefinedTemplate<any>[]
}

export type DefinedPackage = DefinePackageInput

export type PackageManifestTemplate = {
  id: string
  name: string
  defaults: Record<string, unknown>
  fields?: Record<string, FieldDef>
  transition?: TemplateTransition
  live?: TemplateLiveBinding
  jsonSchema: Record<string, unknown>
}

export type PackageManifestConfig = {
  defaults: Record<string, unknown>
  fields?: Record<string, FieldDef>
  jsonSchema: Record<string, unknown>
}

export type PackageManifestDataKey = {
  key: string
  jsonSchema: Record<string, unknown>
}

export type PackageManifestProvider = {
  id: string
  name: string
  publishes: string[]
  scope: 'rundown' | 'host'
  autostart: boolean
}

export type PackageManifestPanel = {
  id: string
  label: string
}

export type PackageManifest = {
  formatVersion: typeof FORMAT_VERSION
  runtime: string
  package: { id: string; name: string; version: string }
  templates: PackageManifestTemplate[]
  config?: PackageManifestConfig
  dataKeys?: PackageManifestDataKey[]
  datasets?: DatasetDeclaration[]
  providers?: PackageManifestProvider[]
  panels?: PackageManifestPanel[]
}

export function defineTemplate<TProps extends Record<string, unknown>>(
  input: DefineTemplateInput<TProps>,
): DefinedTemplate<TProps> {
  return input
}

/** Define an in-process live-data provider (see `ProviderDefinition`). */
export function defineProvider<TConfig extends Record<string, unknown> = Record<string, unknown>>(
  input: ProviderDefinition<TConfig>,
): ProviderDefinition<TConfig> {
  return input
}

export function definePackage(input: DefinePackageInput): DefinedPackage {
  if (!input.id || !/^[a-z0-9][a-z0-9_-]*$/.test(input.id)) {
    throw new Error(`Invalid package id "${input.id}" — use lowercase alphanumerics, - and _`)
  }
  if (!input.templates.length) {
    throw new Error(`Package "${input.id}" must declare at least one template`)
  }
  const seen = new Set<string>()
  for (const t of input.templates) {
    if (seen.has(t.id)) throw new Error(`Duplicate template id "${t.id}" in package "${input.id}"`)
    seen.add(t.id)
  }
  const seenProviders = new Set<string>()
  for (const p of input.providers ?? []) {
    if (seenProviders.has(p.id)) {
      throw new Error(`Duplicate provider id "${p.id}" in package "${input.id}"`)
    }
    seenProviders.add(p.id)
  }
  const seenPanels = new Set<string>()
  for (const panel of input.panels ?? []) {
    if (!panel.id || !/^[a-z0-9][a-z0-9_-]*$/.test(panel.id)) {
      throw new Error(
        `Invalid panel id "${panel.id}" in package "${input.id}" — use lowercase alphanumerics, - and _`,
      )
    }
    if (seenPanels.has(panel.id)) {
      throw new Error(`Duplicate panel id "${panel.id}" in package "${input.id}"`)
    }
    if (!panel.label?.trim()) {
      throw new Error(`Panel "${panel.id}" in package "${input.id}" needs a non-empty label`)
    }
    seenPanels.add(panel.id)
  }
  return input
}
