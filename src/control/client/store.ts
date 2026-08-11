import type { ControlEvent } from '../protocol'
import type { GraphicInstance, RendererSession, Rundown, RundownSnapshot } from '../model'
import {
  createControlSocket,
  defaultControlWsUrl,
  type ControlSocket,
  type ControlSocketStatus,
} from './socket'

export type RundownStoreState = {
  status: ControlSocketStatus
  sessionId: string | null
  snapshot: RundownSnapshot | null
  rundown: Rundown | null
  instances: Map<string, GraphicInstance>
  renderers: Map<string, RendererSession>
  seq: number
  error: { code: string; message: string } | null
  /** Increments on playout.panic; resets when any instance goes on-air. */
  panicSeq: number
}

type Listener = () => void

type SharedEntry = {
  socket: ControlSocket
  state: RundownStoreState
  listeners: Set<Listener>
  refCount: number
  key: string
}

const shared = new Map<string, SharedEntry>()

function emptyState(): RundownStoreState {
  return {
    status: 'connecting',
    sessionId: null,
    snapshot: null,
    rundown: null,
    instances: new Map(),
    renderers: new Map(),
    seq: 0,
    error: null,
    panicSeq: 0,
  }
}

function applySnapshot(state: RundownStoreState, snapshot: RundownSnapshot): RundownStoreState {
  return {
    ...state,
    snapshot,
    rundown: snapshot.rundown,
    instances: new Map(snapshot.instances.map((i) => [i.id, i])),
    renderers: new Map(snapshot.renderers.map((r) => [r.sessionId, r])),
    seq: snapshot.seq,
    error: null,
    panicSeq: 0,
  }
}

function applyEvent(state: RundownStoreState, seq: number, event: ControlEvent): RundownStoreState {
  const next: RundownStoreState = {
    ...state,
    seq,
    instances: new Map(state.instances),
    renderers: new Map(state.renderers),
  }

  switch (event.type) {
    case 'rundown.upserted':
      next.rundown = event.rundown
      // Refresh cued flags on instances.
      for (const [id, inst] of next.instances) {
        next.instances.set(id, {
          ...inst,
          playout: {
            ...inst.playout,
            cued: event.rundown.cuedInstanceId === id,
          },
        })
      }
      break
    case 'rundown.removed':
      if (next.rundown?.id === event.rundownId) {
        next.rundown = null
        next.instances.clear()
      }
      break
    case 'instance.upserted':
      next.instances.set(event.instance.id, event.instance)
      break
    case 'instance.removed':
      next.instances.delete(event.instanceId)
      break
    case 'instance.props': {
      const existing = next.instances.get(event.instanceId)
      if (existing) {
        next.instances.set(event.instanceId, {
          ...existing,
          props: event.props,
          revision: event.revision,
        })
      }
      break
    }
    case 'playout.changed': {
      const existing = next.instances.get(event.instanceId)
      if (existing) {
        next.instances.set(event.instanceId, {
          ...existing,
          playout: event.playout,
          revision: event.revision,
        })
      }
      if (event.playout.onScreen) {
        next.panicSeq = 0
      }
      if (event.rundown) {
        next.rundown = event.rundown
        for (const [id, inst] of next.instances) {
          next.instances.set(id, {
            ...inst,
            playout: {
              ...inst.playout,
              cued: event.rundown.cuedInstanceId === id,
            },
          })
        }
      }
      break
    }
    case 'playout.panic':
      next.panicSeq = state.panicSeq + 1
      break
    case 'renderer.upserted':
      next.renderers.set(event.renderer.sessionId, event.renderer)
      break
    case 'renderer.removed':
      next.renderers.delete(event.sessionId)
      break
    case 'error':
      next.error = event.error
      break
    case 'packages.changed':
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('hydra:packages-changed', { detail: { at: event.at } }),
        )
      }
      break
    case 'activeRundown.changed':
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('hydra:active-rundown-changed', {
            detail: { rundownId: event.rundownId },
          }),
        )
      }
      break
  }

  if (next.rundown) {
    next.snapshot = {
      rundown: next.rundown,
      instances: [...next.instances.values()].sort((a, b) => a.sortOrder - b.sortOrder),
      renderers: [...next.renderers.values()],
      seq: next.seq,
      serverTime: Date.now(),
    }
  }

  return next
}

function notify(entry: SharedEntry) {
  for (const listener of entry.listeners) listener()
}

function setState(entry: SharedEntry, next: RundownStoreState) {
  entry.state = next
  notify(entry)
}

export type AcquireOptions = {
  role: 'control' | 'renderer'
  rundownId: string
  instanceId?: string
  templateId?: string
  label?: string
  url?: string
}

export function acquireRundownStore(options: AcquireOptions): {
  getState: () => RundownStoreState
  subscribe: (listener: Listener) => () => void
  socket: ControlSocket
  release: () => void
} {
  const url = options.url ?? defaultControlWsUrl()
  const key = `${url}|${options.role}|${options.rundownId}|${options.instanceId ?? ''}`

  let entry = shared.get(key)
  if (!entry) {
    const state = emptyState()
    const localEntry: SharedEntry = {
      key,
      state,
      listeners: new Set(),
      refCount: 0,
      socket: null as unknown as ControlSocket,
    }

    localEntry.socket = createControlSocket({
      url,
      role: options.role,
      rundownId: options.rundownId,
      instanceId: options.instanceId,
      templateId: options.templateId,
      label: options.label,
      onStatus: (status) => setState(localEntry, { ...localEntry.state, status }),
      onWelcome: (sessionId) => setState(localEntry, { ...localEntry.state, sessionId }),
      onSnapshot: (snapshot) => setState(localEntry, applySnapshot(localEntry.state, snapshot)),
      onEvent: (seq, event) => setState(localEntry, applyEvent(localEntry.state, seq, event)),
      onError: (error) => setState(localEntry, { ...localEntry.state, error }),
    })

    entry = localEntry
    shared.set(key, entry)
  }

  entry.refCount += 1

  return {
    getState: () => entry!.state,
    subscribe: (listener) => {
      entry!.listeners.add(listener)
      return () => entry!.listeners.delete(listener)
    },
    socket: entry.socket,
    release: () => {
      entry!.refCount -= 1
      if (entry!.refCount <= 0) {
        entry!.socket.close()
        shared.delete(key)
      }
    },
  }
}

/** Apply events optimistically on the local store (before ack). */
export function applyOptimisticEvents(
  getState: () => RundownStoreState,
  setLocal: (next: RundownStoreState) => void,
  events: ControlEvent[],
): void {
  let state = getState()
  for (const event of events) {
    state = applyEvent(state, state.seq + 1, event)
  }
  setLocal(state)
}

export { applyEvent, applySnapshot }
