import { useSyncExternalStore } from 'react'
import { basketballScorebugDefaultProps } from './basketball-scorebug/-types'

export type DrexelClockState = {
  running: boolean
  clock: string
  shotClock: number
}

export type DrexelClockTick = {
  clock: string
  shotClock: number
}

type Listener = () => void
type ClockSink = (tick: DrexelClockTick) => void

export function clockToSeconds(clock: string): number {
  const [minutes, seconds] = clock.split(':').map((part) => Number.parseInt(part, 10))
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return 0
  return Math.max(0, minutes * 60 + seconds)
}

export function secondsToClock(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds)
  const minutes = Math.floor(clamped / 60)
  const seconds = clamped % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function numericClockValue(value: number | string): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value), 10)
  return Number.isFinite(n) ? n : 0
}

const listeners = new Set<Listener>()
const sinks = new Set<ClockSink>()
let intervalId: ReturnType<typeof setInterval> | null = null

let state: DrexelClockState = {
  running: false,
  clock: basketballScorebugDefaultProps.clock,
  shotClock: numericClockValue(basketballScorebugDefaultProps.shotClock),
}

function emit() {
  for (const listener of listeners) listener()
}

function setState(partial: Partial<DrexelClockState>) {
  state = { ...state, ...partial }
  emit()
}

function clearTicker() {
  if (intervalId == null) return
  clearInterval(intervalId)
  intervalId = null
}

function notifySinks(tick: DrexelClockTick) {
  for (const sink of sinks) sink(tick)
}

function tickOnce() {
  const remaining = clockToSeconds(state.clock)
  if (remaining <= 0) {
    clearTicker()
    setState({ running: false })
    return
  }

  const nextClock = secondsToClock(remaining - 1)
  const nextShot = state.shotClock > 0 ? state.shotClock - 1 : state.shotClock
  const hitZero = remaining - 1 <= 0

  setState({
    clock: nextClock,
    shotClock: nextShot,
    ...(hitZero ? { running: false } : null),
  })

  if (hitZero) clearTicker()

  notifySinks({ clock: nextClock, shotClock: nextShot })
}

function ensureTicker() {
  if (!state.running || intervalId != null) return
  intervalId = setInterval(tickOnce, 1000)
}

export function getDrexelClockSnapshot(): DrexelClockState {
  return state
}

export function subscribeDrexelClock(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Register a Controls patch sink; returns unsubscribe. */
export function registerDrexelClockSink(sink: ClockSink): () => void {
  sinks.add(sink)
  return () => {
    sinks.delete(sink)
  }
}

export function setDrexelClockValues(clock: string, shotClock: number | string): void {
  setState({
    clock,
    shotClock: numericClockValue(shotClock),
  })
}

export function setDrexelClockRunning(running: boolean): void {
  if (running === state.running) {
    if (running) ensureTicker()
    return
  }

  if (!running) {
    clearTicker()
    setState({ running: false })
    return
  }

  setState({ running: true })
  ensureTicker()
}

export function useDrexelClock(): DrexelClockState {
  return useSyncExternalStore(subscribeDrexelClock, getDrexelClockSnapshot, getDrexelClockSnapshot)
}
