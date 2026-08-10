import type { ControlEvent } from '../protocol'
import type { GraphicInstance, RendererSession, Rundown } from '../model'

type HubListener = (seq: number, event: ControlEvent, rundownId: string) => void

type HubState = {
  seq: number
  listeners: Set<HubListener>
  /** Per-rundown last seq for snapshots. */
  rundownSeq: Map<string, number>
}

type GlobalHub = typeof globalThis & {
  __controllerHub?: HubState
}

function getState(): HubState {
  const g = globalThis as GlobalHub
  if (!g.__controllerHub) {
    g.__controllerHub = {
      seq: 0,
      listeners: new Set(),
      rundownSeq: new Map(),
    }
  }
  return g.__controllerHub
}

export function getHubSeq(rundownId?: string): number {
  const state = getState()
  if (rundownId) return state.rundownSeq.get(rundownId) ?? 0
  return state.seq
}

export function subscribe(listener: HubListener): () => void {
  const state = getState()
  state.listeners.add(listener)
  return () => state.listeners.delete(listener)
}

export function publish(rundownId: string, event: ControlEvent): number {
  const state = getState()
  state.seq += 1
  const seq = state.seq
  state.rundownSeq.set(rundownId, seq)
  for (const listener of state.listeners) {
    try {
      listener(seq, event, rundownId)
    } catch (err) {
      console.error('[control/hub] listener error', err)
    }
  }
  return seq
}

export function publishMany(rundownId: string, events: ControlEvent[]): number {
  let seq = getHubSeq(rundownId)
  for (const event of events) {
    seq = publish(rundownId, event)
  }
  return seq
}

/** Test helper. */
export function resetHub(): void {
  const g = globalThis as GlobalHub
  g.__controllerHub = undefined
}

export type SnapshotParts = {
  rundown: Rundown
  instances: GraphicInstance[]
  renderers: RendererSession[]
}
