import { z } from 'zod'
import type { TemplateSchema } from './types'
import { laborOfLoveLowerThirdTemplateSchema } from '#/routes/graphics/labor-of-love/lower-third/-schema'
import { laborOfLoveBracketTemplateSchema } from '#/routes/graphics/labor-of-love/bracket/-schema'
import { basketballScorebugTemplateSchema } from '#/routes/graphics/drexel/basketball-scorebug/-schema'
import {
  getDynamicTemplateSchema,
  listDynamicTemplates,
  listLoadedPackages,
  type LoadedPackage,
} from '#/control/server/packages'

/** Server-safe template registry — zod schemas and metadata only, no React. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const STATIC_TEMPLATES: TemplateSchema<any>[] = [
  laborOfLoveLowerThirdTemplateSchema,
  laborOfLoveBracketTemplateSchema,
  basketballScorebugTemplateSchema,
]

const staticById = new Map(STATIC_TEMPLATES.map((t) => [t.id, t]))

export function listStaticTemplates(): TemplateSchema<Record<string, unknown>>[] {
  return STATIC_TEMPLATES as TemplateSchema<Record<string, unknown>>[]
}

export function listTemplates(): TemplateSchema<Record<string, unknown>>[] {
  const dynamic = listDynamicTemplates()
  return [
    ...(STATIC_TEMPLATES as TemplateSchema<Record<string, unknown>>[]),
    ...dynamic,
  ]
}

export function getTemplateSchema(
  id: string,
): TemplateSchema<Record<string, unknown>> | undefined {
  const staticHit = staticById.get(id) as TemplateSchema<Record<string, unknown>> | undefined
  if (staticHit) return staticHit
  return getDynamicTemplateSchema(id)
}

export function getTemplateIds(): string[] {
  return listTemplates().map((t) => t.id)
}

export type TemplatePublicMeta = {
  id: string
  name: string
  route: string
  defaults: Record<string, unknown>
  fields: TemplateSchema<Record<string, unknown>>['fields']
  transition?: TemplateSchema<Record<string, unknown>>['transition']
  jsonSchema: Record<string, unknown>
  packageId?: string
}

export type PackagePublicMeta = {
  id: string
  name: string
  version: string
  bundleUrl: string
  contentHash: string
  error: string | null
  templateIds: string[]
}

function toPublicMeta(t: TemplateSchema<Record<string, unknown>> & { packageId?: string }): TemplatePublicMeta {
  return {
    id: t.id,
    name: t.name,
    route: t.route,
    defaults: t.defaults as Record<string, unknown>,
    fields: t.fields,
    transition: t.transition,
    jsonSchema: z.toJSONSchema(t.schema) as Record<string, unknown>,
    packageId: t.packageId,
  }
}

export function listTemplatesPublic(): TemplatePublicMeta[] {
  return listTemplates().map((t) =>
    toPublicMeta(t as TemplateSchema<Record<string, unknown>> & { packageId?: string }),
  )
}

export function listPackagesPublic(): PackagePublicMeta[] {
  return listLoadedPackages().map((p: LoadedPackage) => ({
    id: p.id,
    name: p.name,
    version: p.version,
    bundleUrl: p.bundleUrl,
    contentHash: p.contentHash,
    error: p.error,
    templateIds: p.templates.map((t) => t.id),
  }))
}
