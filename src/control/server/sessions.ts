import type { PlaybackPhase, RendererSession, ClientRole } from '../model'
import { publish } from './hub'
import type { ControlEvent } from '../protocol'

export type SessionSend = (data: string) => void

export type LiveSession = {
  sessionId: string
  role: ClientRole
  rundownId: string
  instanceId: string | null
  templateId: string | null
  label: string | null
  connectedAt: number
  lastSeenAt: number
  phase: PlaybackPhase
  ackedRevision: number
  message: string | null
  subscribed: Set<string>
  send: SessionSend
}

type SessionsState = {
  byId: Map<string, LiveSession>
}

type GlobalSessions = typeof globalThis & {
  __controllerSessions?: SessionsState
}

function getState(): SessionsState {
  const g = globalThis as GlobalSessions
  if (!g.__controllerSessions) {
    g.__controllerSessions = { byId: new Map() }
  }
  return g.__controllerSessions
}

export function createSession(input: {
  role: ClientRole
  rundownId: string
  instanceId?: string | null
  templateId?: string | null
  label?: string | null
  send: SessionSend
}): LiveSession {
  const now = Date.now()
  const session: LiveSession = {
    sessionId: crypto.randomUUID(),
    role: input.role,
    rundownId: input.rundownId,
    instanceId: input.instanceId ?? null,
    templateId: input.templateId ?? null,
    label: input.label ?? null,
    connectedAt: now,
    lastSeenAt: now,
    phase: 'unknown',
    ackedRevision: 0,
    message: null,
    subscribed: new Set([input.rundownId]),
    send: input.send,
  }
  getState().byId.set(session.sessionId, session)

  if (session.role === 'renderer') {
    const event: ControlEvent = {
      type: 'renderer.upserted',
      renderer: toRendererSession(session),
    }
    publish(session.rundownId, event)
  }

  return session
}

export function removeSession(sessionId: string): void {
  const state = getState()
  const session = state.byId.get(sessionId)
  if (!session) return
  state.byId.delete(sessionId)

  if (session.role === 'renderer') {
    const event: ControlEvent = {
      type: 'renderer.removed',
      sessionId: session.sessionId,
      rundownId: session.rundownId,
    }
    publish(session.rundownId, event)
  }
}

export function getSession(sessionId: string): LiveSession | undefined {
  return getState().byId.get(sessionId)
}

export function touchSession(sessionId: string): void {
  const session = getState().byId.get(sessionId)
  if (session) session.lastSeenAt = Date.now()
}

export function reportPhase(
  sessionId: string,
  input: {
    instanceId: string
    phase: PlaybackPhase
    revision: number
    message?: string
  },
): RendererSession | null {
  const session = getState().byId.get(sessionId)
  if (!session || session.role !== 'renderer') return null

  session.lastSeenAt = Date.now()
  session.instanceId = input.instanceId
  session.phase = input.phase
  session.ackedRevision = input.revision
  session.message = input.message ?? null

  const renderer = toRendererSession(session)
  publish(session.rundownId, { type: 'renderer.upserted', renderer })
  return renderer
}

export function listRenderers(rundownId: string): RendererSession[] {
  return [...getState().byId.values()]
    .filter((s) => s.role === 'renderer' && s.rundownId === rundownId)
    .map(toRendererSession)
}

export function listSessionsForRundown(rundownId: string): LiveSession[] {
  return [...getState().byId.values()].filter(
    (s) => s.subscribed.has(rundownId) || s.rundownId === rundownId,
  )
}

export function listAllSessions(): LiveSession[] {
  return [...getState().byId.values()]
}

export function broadcastToRundown(rundownId: string, payload: string): void {
  for (const session of listSessionsForRundown(rundownId)) {
    try {
      session.send(payload)
    } catch (err) {
      console.error('[control/sessions] send failed', session.sessionId, err)
    }
  }
}

export function toRendererSession(session: LiveSession): RendererSession {
  return {
    sessionId: session.sessionId,
    rundownId: session.rundownId,
    instanceId: session.instanceId,
    templateId: session.templateId,
    label: session.label,
    connectedAt: session.connectedAt,
    lastSeenAt: session.lastSeenAt,
    phase: session.phase,
    ackedRevision: session.ackedRevision,
    message: session.message,
  }
}

/** Drop sessions older than `maxAgeMs` without a heartbeat. */
export function sweepStaleSessions(maxAgeMs = 60_000): number {
  const now = Date.now()
  let removed = 0
  for (const session of getState().byId.values()) {
    if (now - session.lastSeenAt > maxAgeMs) {
      removeSession(session.sessionId)
      removed += 1
    }
  }
  return removed
}

export function resetSessions(): void {
  const g = globalThis as GlobalSessions
  g.__controllerSessions = undefined
}
