import type { z } from 'zod'
import type { ComponentType } from 'react'

export type FieldDefType =
  | 'text'
  | 'number'
  | 'color'
  | 'select'
  | 'checkbox'
  | 'switch'
  | 'slider'
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
  /** Slider range (also usable as hints for number fields). */
  min?: number
  max?: number
  step?: number
}

export type TemplateTransition = {
  /** Approximate enter animation duration in ms (used for phase inference). */
  inMs: number
  /** Approximate exit animation duration in ms (used for phase inference). */
  outMs: number
}

/**
 * Declarative live-data bindings: maps a prop path (dotted, e.g. `homeTeam.score`)
 * to a source path read from the rundown's live-data context (`data.<key>...` or
 * `config.<path>`). Resolved server-side by the projector; JSON-safe so it can be
 * inspected from the manifest.
 */
export type TemplateLiveBinding = {
  bind?: Record<string, string>
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
  /** Optional binding of live rundown data / package config onto props. */
  live?: TemplateLiveBinding
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

// ── Package-level config, data keys, and providers ──────────────────────────

/** Package-level operator config (home/away team, sport, season, ...). */
export type PackageConfigDef<TConfig extends Record<string, unknown>> = {
  schema: z.ZodType<TConfig>
  defaults: TConfig
  fields?: { [K in keyof TConfig & string]?: FieldDef }
}

/** A dataset the package wants Hydra to fetch + cache (teams, rosters, standings, ...). */
export type DatasetDeclaration = {
  id: string
  url: string
  /** Cache lifetime before background revalidation. Defaults to 1 hour. */
  ttlMs?: number
}

export type ProviderState = 'idle' | 'starting' | 'ok' | 'error' | 'stopped'

export type ProviderStatus = {
  packageId: string
  providerId: string
  state: ProviderState
  message: string | null
  at: number
}

/**
 * Runtime handle passed to a provider's `start`. Providers are in-process
 * server-side JavaScript — no child process, no interpreter discovery.
 */
export type ProviderContext<TConfig extends Record<string, unknown> = Record<string, unknown>> = {
  rundownId: string
  packageId: string
  providerId: string
  /** Always current — reflects the rundown's live package config. */
  readonly config: TConfig
  /** Publish a full value for a declared data key. */
  publish: (key: string, value: unknown) => void
  /** Shallow/deep-merge a patch into the current value of a data key. */
  patch: (key: string, patch: Record<string, unknown>) => void
  /** Read a cached dataset the package declared (undefined until first fetched). */
  dataset: (id: string) => unknown
  log: (message: string) => void
  setStatus: (status: Partial<Pick<ProviderStatus, 'state' | 'message'>>) => void
  /** Aborts on stop/detach/config-restart — cancels in-flight fetches, exits loops. */
  signal: AbortSignal
}

export type ProviderDefinition<TConfig extends Record<string, unknown> = Record<string, unknown>> = {
  id: string
  name: string
  /** Data keys this provider is expected to publish (informational + manifest). */
  publishes?: string[]
  /** `rundown` (default): one instance per attached rundown. `host`: one shared instance. */
  scope?: 'rundown' | 'host'
  /** Start automatically when the package is attached to a rundown. Defaults to true. */
  autostart?: boolean
  /** Stop + restart the provider when package config changes. Defaults to true. */
  restartOnConfigChange?: boolean
  /**
   * Run the provider. Return a cleanup function, or run an async loop that
   * exits when `ctx.signal` aborts. Thrown errors are caught and retried
   * with backoff — never let a provider crash the control plane.
   */
  start: (
    ctx: ProviderContext<TConfig>,
  ) => void | (() => void) | Promise<void | (() => void)>
}

// ── Package control panels (rundown tab extension point) ─────────────────────

/** One live-data row scoped to this package (passed into package panels). */
export type PackagePanelLiveDatum = {
  key: string
  value: unknown
  revision: number
  updatedAt: number
}

/**
 * Props Hydra passes to a package-registered control panel. Panels render as
 * top-level rundown tabs when the package is attached.
 */
export type PackagePanelProps<TConfig extends Record<string, unknown> = Record<string, unknown>> = {
  rundownId: string
  packageId: string
  config: TConfig
  patchConfig: (patch: Partial<TConfig>) => void
  replaceConfig: (next: TConfig) => void
  /** Live-data values for this package only. */
  data: PackagePanelLiveDatum[]
  /** Provider statuses for this package only. */
  providers: ProviderStatus[]
  publishData: (key: string, value: unknown) => void
  clearData: (key: string) => void
  startProvider: (providerId: string) => void
  stopProvider: (providerId: string) => void
}
