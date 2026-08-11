import type { ComponentType } from 'react'
import type { z } from 'zod'
import type {
  FieldDef,
  TemplateControlsProps,
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
  /** Lazy factory — keep DOM libraries out of the server import graph. */
  Render: ComponentFactory<TemplateRenderProps<TProps>>
  Controls?: ComponentFactory<TemplateControlsProps<TProps>>
  PreviewControls?: ComponentFactory<TemplateControlsProps<TProps>>
}

export type DefinedTemplate<TProps extends Record<string, unknown> = Record<string, unknown>> =
  DefineTemplateInput<TProps> & {
    /** Filled by the host when the package is installed. */
    route?: string
    packageId?: string
  }

export type DefinePackageInput = {
  id: string
  name: string
  version: string
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
  jsonSchema: Record<string, unknown>
}

export type PackageManifest = {
  formatVersion: typeof FORMAT_VERSION
  runtime: string
  package: { id: string; name: string; version: string }
  templates: PackageManifestTemplate[]
}

export function defineTemplate<TProps extends Record<string, unknown>>(
  input: DefineTemplateInput<TProps>,
): DefinedTemplate<TProps> {
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
  return input
}
