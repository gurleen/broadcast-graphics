import type { z } from 'zod'
import type { ComponentType } from 'react'

export type FieldDefType =
  | 'text'
  | 'number'
  | 'color'
  | 'select'
  | 'checkbox'
  | 'switch'
  | 'readonly'

export type FieldDef = {
  label: string
  type?: FieldDefType
  options?: (string | { value: string; label: string })[]
  caption?: string
  labels?: [string, string]
  unit?: string
  align?: 'left' | 'right'
  section?: string
}

export type TemplateTransition = {
  /** Approximate enter animation duration in ms (used for phase inference). */
  inMs: number
  /** Approximate exit animation duration in ms (used for phase inference). */
  outMs: number
}

export type TemplateSchema<TProps extends Record<string, unknown>> = {
  id: string
  name: string
  /** Renderer page path, e.g. `/graphics/labor-of-love/lower-third`. */
  route: string
  schema: z.ZodType<TProps>
  defaults: TProps
  fields?: { [K in keyof TProps & string]?: FieldDef }
  transition?: TemplateTransition
}

export type TemplateRenderProps<TProps> = {
  props: TProps
  onScreen: boolean
}

export type TemplateControlsProps<TProps> = {
  props: TProps
  patch: (patch: Partial<TProps>) => void
  replace: (next: TProps) => void
  onScreen: boolean
  setOnScreen: (onScreen: boolean) => void
}

export type TemplateDefinition<TProps extends Record<string, unknown>> = TemplateSchema<TProps> & {
  Render: ComponentType<TemplateRenderProps<TProps>>
  Controls?: ComponentType<TemplateControlsProps<TProps>>
}
