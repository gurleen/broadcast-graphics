import { z } from 'zod'

/** Authoritative playout intent persisted on the server. */
export const PlayoutIntent = z.enum(['out', 'in'])
export type PlayoutIntent = z.infer<typeof PlayoutIntent>

/** Playback phase reported by renderer sessions (ephemeral). */
export const PlaybackPhase = z.enum([
  'unknown',
  'offscreen',
  'entering',
  'onscreen',
  'exiting',
  'error',
])
export type PlaybackPhase = z.infer<typeof PlaybackPhase>

export const ClientRole = z.enum(['control', 'renderer'])
export type ClientRole = z.infer<typeof ClientRole>

export const Rundown = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  cuedInstanceId: z.string().nullable(),
  sortOrder: z.number().int(),
})
export type Rundown = z.infer<typeof Rundown>

export const InstancePlayout = z.object({
  intent: PlayoutIntent,
  /** Derived: `intent === 'in'`. */
  onScreen: z.boolean(),
  /** True when this instance is the rundown's cued (PVW) item. */
  cued: z.boolean(),
  changedAt: z.number(),
})
export type InstancePlayout = z.infer<typeof InstancePlayout>

export const GraphicInstance = z.object({
  id: z.string(),
  rundownId: z.string(),
  templateId: z.string(),
  label: z.string(),
  sortOrder: z.number().int(),
  layer: z.number().int(),
  /** Validated against the template schema at write time; opaque here. */
  props: z.record(z.string(), z.unknown()),
  playout: InstancePlayout,
  /** Bumps on every props or playout change. */
  revision: z.number().int(),
  updatedAt: z.number(),
})
export type GraphicInstance = z.infer<typeof GraphicInstance>

export const RendererSession = z.object({
  sessionId: z.string(),
  rundownId: z.string(),
  instanceId: z.string().nullable(),
  templateId: z.string().nullable(),
  label: z.string().nullable(),
  connectedAt: z.number(),
  lastSeenAt: z.number(),
  phase: PlaybackPhase,
  ackedRevision: z.number().int(),
  message: z.string().nullable(),
})
export type RendererSession = z.infer<typeof RendererSession>

/** A package attached to a rundown, carrying its per-rundown config. */
export const PackageAttachment = z.object({
  packageId: z.string(),
  attached: z.boolean(),
  config: z.record(z.string(), z.unknown()),
  attachedAt: z.number(),
})
export type PackageAttachment = z.infer<typeof PackageAttachment>

/** A live-data value published by a provider (or external producer) for a rundown. */
export const LiveDataRecord = z.object({
  packageId: z.string(),
  key: z.string(),
  value: z.unknown(),
  revision: z.number().int(),
  updatedAt: z.number(),
})
export type LiveDataRecord = z.infer<typeof LiveDataRecord>

export const ProviderState = z.enum(['idle', 'starting', 'ok', 'error', 'stopped'])
export type ProviderState = z.infer<typeof ProviderState>

export const ProviderStatusRecord = z.object({
  packageId: z.string(),
  providerId: z.string(),
  state: ProviderState,
  message: z.string().nullable(),
  at: z.number(),
})
export type ProviderStatusRecord = z.infer<typeof ProviderStatusRecord>

export const RundownSnapshot = z.object({
  rundown: Rundown,
  instances: z.array(GraphicInstance),
  renderers: z.array(RendererSession),
  /** Packages attached to this rundown (only attached === true). */
  packages: z.array(PackageAttachment),
  /** Current live-data values for attached packages. */
  data: z.array(LiveDataRecord),
  /** Live status of in-process providers running for this rundown. */
  providers: z.array(ProviderStatusRecord),
  seq: z.number().int(),
  serverTime: z.number(),
})
export type RundownSnapshot = z.infer<typeof RundownSnapshot>

export const ProtocolError = z.object({
  code: z.string(),
  message: z.string(),
})
export type ProtocolError = z.infer<typeof ProtocolError>

/**
 * Aggregate phase for an instance from its attached renderer sessions.
 * No renderers → unknown; any entering/exiting wins; otherwise the shared phase.
 */
export function aggregatePhase(renderers: RendererSession[]): PlaybackPhase {
  if (renderers.length === 0) return 'unknown'
  if (renderers.some((r) => r.phase === 'error')) return 'error'
  if (renderers.some((r) => r.phase === 'entering')) return 'entering'
  if (renderers.some((r) => r.phase === 'exiting')) return 'exiting'
  const phases = new Set(renderers.map((r) => r.phase))
  if (phases.size === 1) return renderers[0]!.phase
  if (phases.has('onscreen')) return 'onscreen'
  if (phases.has('offscreen')) return 'offscreen'
  return 'unknown'
}
