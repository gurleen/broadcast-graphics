import type { ComponentType } from 'react'
import type { TemplateDefinition, TemplateRenderProps } from './types'
import { getCachedTemplate } from '#/packages/loader'
import {
  getTemplateDefinition,
  listTemplateDefinitions,
} from './registry-static'

export { getTemplateDefinition, listTemplateDefinitions }

/** Static first, then any already-loaded dynamic package template. */
export function resolveTemplateDefinition(
  id: string,
): TemplateDefinition<Record<string, unknown>> | undefined {
  return getTemplateDefinition(id) ?? getCachedTemplate(id)
}

export function getTemplateRender(
  id: string,
): ComponentType<TemplateRenderProps<Record<string, unknown>>> | undefined {
  return resolveTemplateDefinition(id)?.Render
}
