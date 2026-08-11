import { z } from 'zod'
import {
  GraphicInstance,
  PlaybackPhase,
  ProtocolError,
  Rundown,
  RundownSnapshot,
  RendererSession,
  ClientRole,
} from './model'

export const PROTOCOL_VERSION = 1 as const

// ── Commands (mutations issued by control clients / REST) ──────────────────

export const ControlCommand = z.discriminatedUnion('type', [
  z.object({ type: z.literal('rundown.create'), name: z.string().min(1) }),
  z.object({
    type: z.literal('rundown.rename'),
    rundownId: z.string(),
    name: z.string().min(1),
  }),
  z.object({ type: z.literal('rundown.delete'), rundownId: z.string() }),
  z.object({
    type: z.literal('rundown.reorder'),
    orderedIds: z.array(z.string()).min(1),
  }),
  z.object({
    type: z.literal('rundown.setActive'),
    /** `null` clears the default `/render` pointer. */
    rundownId: z.string().nullable(),
  }),
  z.object({
    type: z.literal('instance.add'),
    rundownId: z.string(),
    templateId: z.string(),
    label: z.string().optional(),
    props: z.record(z.string(), z.unknown()).optional(),
    layer: z.number().int().optional(),
  }),
  z.object({
    type: z.literal('instance.remove'),
    instanceId: z.string(),
  }),
  z.object({
    type: z.literal('instance.relabel'),
    instanceId: z.string(),
    label: z.string().min(1),
  }),
  z.object({
    type: z.literal('instance.reorder'),
    rundownId: z.string(),
    orderedIds: z.array(z.string()).min(1),
  }),
  z.object({
    type: z.literal('instance.patchProps'),
    instanceId: z.string(),
    patch: z.record(z.string(), z.unknown()),
  }),
  z.object({
    type: z.literal('instance.replaceProps'),
    instanceId: z.string(),
    props: z.record(z.string(), z.unknown()),
  }),
  z.object({
    type: z.literal('instance.resetProps'),
    instanceId: z.string(),
  }),
  z.object({ type: z.literal('playout.cue'), instanceId: z.string() }),
  z.object({
    type: z.literal('playout.take'),
    /** Defaults to the rundown's currently cued instance. */
    instanceId: z.string().optional(),
    rundownId: z.string().optional(),
  }),
  z.object({ type: z.literal('playout.in'), instanceId: z.string() }),
  z.object({ type: z.literal('playout.out'), instanceId: z.string() }),
  z.object({ type: z.literal('playout.toggle'), instanceId: z.string() }),
  z.object({ type: z.literal('playout.clearAll'), rundownId: z.string() }),
  z.object({ type: z.literal('playout.panic'), rundownId: z.string() }),
])
export type ControlCommand = z.infer<typeof ControlCommand>

// ── Events (server → clients) ──────────────────────────────────────────────

export const ControlEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('rundown.upserted'), rundown: Rundown }),
  z.object({ type: z.literal('rundown.removed'), rundownId: z.string() }),
  z.object({ type: z.literal('instance.upserted'), instance: GraphicInstance }),
  z.object({
    type: z.literal('instance.removed'),
    instanceId: z.string(),
    rundownId: z.string(),
  }),
  z.object({
    type: z.literal('instance.props'),
    instanceId: z.string(),
    rundownId: z.string(),
    patch: z.record(z.string(), z.unknown()),
    props: z.record(z.string(), z.unknown()),
    revision: z.number().int(),
  }),
  z.object({
    type: z.literal('playout.changed'),
    instanceId: z.string(),
    rundownId: z.string(),
    playout: GraphicInstance.shape.playout,
    revision: z.number().int(),
    /** When cue pointer moved, include the updated rundown. */
    rundown: Rundown.optional(),
  }),
  z.object({
    type: z.literal('playout.panic'),
    rundownId: z.string(),
    at: z.number(),
  }),
  z.object({ type: z.literal('renderer.upserted'), renderer: RendererSession }),
  z.object({
    type: z.literal('renderer.removed'),
    sessionId: z.string(),
    rundownId: z.string(),
  }),
  z.object({
    type: z.literal('packages.changed'),
    at: z.number(),
  }),
  z.object({
    type: z.literal('activeRundown.changed'),
    rundownId: z.string().nullable(),
  }),
  z.object({ type: z.literal('error'), error: ProtocolError }),
])
export type ControlEvent = z.infer<typeof ControlEvent>

// ── Client → server frames ─────────────────────────────────────────────────

export const ClientMessage = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('hello'),
    role: ClientRole,
    rundownId: z.string(),
    instanceId: z.string().optional(),
    templateId: z.string().optional(),
    label: z.string().optional(),
    protocolVersion: z.number().int(),
  }),
  z.object({ type: z.literal('subscribe'), rundownId: z.string() }),
  z.object({ type: z.literal('unsubscribe'), rundownId: z.string() }),
  z.object({
    type: z.literal('command'),
    commandId: z.string(),
    command: ControlCommand,
  }),
  z.object({
    type: z.literal('report'),
    instanceId: z.string(),
    phase: PlaybackPhase,
    revision: z.number().int(),
    message: z.string().optional(),
  }),
  z.object({ type: z.literal('ping'), id: z.string().optional() }),
])
export type ClientMessage = z.infer<typeof ClientMessage>

// ── Server → client frames ─────────────────────────────────────────────────

export const ServerMessage = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('welcome'),
    sessionId: z.string(),
    serverTime: z.number(),
    protocolVersion: z.literal(PROTOCOL_VERSION),
  }),
  z.object({ type: z.literal('snapshot'), snapshot: RundownSnapshot }),
  z.object({
    type: z.literal('event'),
    seq: z.number().int(),
    event: ControlEvent,
  }),
  z.object({
    type: z.literal('ack'),
    commandId: z.string(),
    ok: z.boolean(),
    error: ProtocolError.optional(),
    events: z.array(ControlEvent).optional(),
  }),
  z.object({ type: z.literal('pong'), id: z.string().optional() }),
  z.object({ type: z.literal('error'), error: ProtocolError }),
])
export type ServerMessage = z.infer<typeof ServerMessage>

export function parseClientMessage(raw: unknown):
  | { ok: true; message: ClientMessage }
  | { ok: false; error: { code: string; message: string } } {
  const parsed = ClientMessage.safeParse(raw)
  if (parsed.success) return { ok: true, message: parsed.data }
  return {
    ok: false,
    error: {
      code: 'invalid_message',
      message: parsed.error.issues.map((i) => i.message).join('; ') || 'Invalid client message',
    },
  }
}

export function parseControlCommand(raw: unknown):
  | { ok: true; command: ControlCommand }
  | { ok: false; error: { code: string; message: string } } {
  const parsed = ControlCommand.safeParse(raw)
  if (parsed.success) return { ok: true, command: parsed.data }
  return {
    ok: false,
    error: {
      code: 'invalid_command',
      message: parsed.error.issues.map((i) => i.message).join('; ') || 'Invalid command',
    },
  }
}
