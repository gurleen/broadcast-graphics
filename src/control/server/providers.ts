/**
 * In-process live-data provider runner. Providers are plain server-side
 * JavaScript shipped inside a package — no child process, no interpreter
 * discovery, no PATH problems. A crashing provider must never take down the
 * control plane, so every provider run is isolated behind try/catch + backoff.
 */
import type { ProviderContext, ProviderDefinition, ProviderState } from '#/templates/types'
import type { ControlEvent } from '../protocol'
import { deepMerge } from './util'
import { getDatasetSync, ensureDataset } from './datasets'
import { getLoadedPackage } from './packages'
import { publishMany } from './hub'
import { recomputeRundownProjection } from './projector'
import * as store from './store'

type RunningProvider = {
  key: string
  rundownId: string
  packageId: string
  providerId: string
  abort: AbortController
  status: { state: ProviderState; message: string | null; at: number }
  logs: string[]
  failureCount: number
  cleanup?: () => void
  restartTimer?: ReturnType<typeof setTimeout>
}

type GlobalProviders = typeof globalThis & { __controllerProviders?: Map<string, RunningProvider> }

function state(): Map<string, RunningProvider> {
  const g = globalThis as GlobalProviders
  if (!g.__controllerProviders) g.__controllerProviders = new Map()
  return g.__controllerProviders
}

function runnerKey(rundownId: string, packageId: string, providerId: string): string {
  return `${rundownId}:${packageId}:${providerId}`
}

const LOG_LIMIT = 100

function pushLog(running: RunningProvider, message: string): void {
  running.logs.push(`[${new Date().toISOString()}] ${message}`)
  if (running.logs.length > LOG_LIMIT) running.logs.splice(0, running.logs.length - LOG_LIMIT)
}

function emitStatus(running: RunningProvider): void {
  const event: ControlEvent = {
    type: 'provider.status',
    rundownId: running.rundownId,
    packageId: running.packageId,
    providerId: running.providerId,
    state: running.status.state,
    message: running.status.message,
    at: running.status.at,
  }
  publishMany(running.rundownId, [event])
}

function setStatus(running: RunningProvider, partial: Partial<{ state: ProviderState; message: string | null }>) {
  running.status = { ...running.status, ...partial, at: Date.now() }
  emitStatus(running)
}

function publishProviderData(rundownId: string, packageId: string, key: string, value: unknown): void {
  const pkg = getLoadedPackage(packageId)
  const schema = pkg?.dataSchemas?.[key]
  let nextValue = value
  if (schema) {
    const parsed = schema.safeParse(value)
    if (!parsed.success) {
      console.warn(`[providers] ${packageId} published invalid data for key "${key}"`, parsed.error.message)
      return
    }
    nextValue = parsed.data
  }
  const record = store.publishRundownData(rundownId, packageId, key, nextValue)
  publishMany(rundownId, [
    {
      type: 'data.changed',
      rundownId,
      packageId,
      key,
      value: record.value,
      revision: record.revision,
      updatedAt: record.updatedAt,
    },
  ])
  recomputeRundownProjection(rundownId)
}

function makeContext(running: RunningProvider): ProviderContext {
  const { rundownId, packageId, providerId } = running
  return {
    rundownId,
    packageId,
    providerId,
    get config() {
      return store.getPackageAttachment(rundownId, packageId)?.config ?? {}
    },
    publish: (key, value) => publishProviderData(rundownId, packageId, key, value),
    patch: (key, patch) => {
      const current = store.getRundownDataValue(rundownId, packageId, key)
      const base = current && typeof current === 'object' ? (current as Record<string, unknown>) : {}
      publishProviderData(rundownId, packageId, key, deepMerge(base, patch))
    },
    dataset: (id) => {
      const cached = getDatasetSync(packageId, id)
      if (cached === undefined) void ensureDataset(packageId, id)
      return cached
    },
    log: (message) => pushLog(running, message),
    setStatus: (partial) => setStatus(running, partial),
    signal: running.abort.signal,
  }
}

async function runLoop(running: RunningProvider, def: ProviderDefinition): Promise<void> {
  const s = state()
  try {
    setStatus(running, { state: 'ok', message: null })
    const ctx = makeContext(running)
    const cleanup = await def.start(ctx)
    if (typeof cleanup === 'function') running.cleanup = cleanup
    if (!running.abort.signal.aborted) {
      // `start` resolved on its own (e.g. one-shot or finite loop) — treat as a
      // clean stop, not an error.
      setStatus(running, { state: 'stopped', message: null })
      s.delete(running.key)
    }
  } catch (err) {
    if (running.abort.signal.aborted) {
      s.delete(running.key)
      return
    }
    running.failureCount += 1
    const message = err instanceof Error ? err.message : String(err)
    pushLog(running, `error: ${message}`)
    setStatus(running, { state: 'error', message })
    const backoffMs = Math.min(30_000, 1000 * 2 ** Math.min(running.failureCount, 5))
    running.restartTimer = setTimeout(() => {
      s.delete(running.key)
      startProvider(running.rundownId, running.packageId, running.providerId)
    }, backoffMs)
  }
}

export function startProvider(rundownId: string, packageId: string, providerId: string): void {
  const key = runnerKey(rundownId, packageId, providerId)
  const s = state()
  if (s.has(key)) return

  const pkg = getLoadedPackage(packageId)
  const def = pkg?.providers?.find((p) => p.id === providerId)
  if (!def) return

  const running: RunningProvider = {
    key,
    rundownId,
    packageId,
    providerId,
    abort: new AbortController(),
    status: { state: 'starting', message: null, at: Date.now() },
    logs: [],
    failureCount: 0,
  }
  s.set(key, running)
  emitStatus(running)
  void runLoop(running, def)
}

/** Start every provider on a package flagged `autostart` (default true) for a rundown. */
export function startAutostartProviders(rundownId: string, packageId: string): void {
  const pkg = getLoadedPackage(packageId)
  for (const def of pkg?.providers ?? []) {
    if (def.autostart === false) continue
    startProvider(rundownId, packageId, def.id)
  }
}

export function stopProvider(rundownId: string, packageId: string, providerId: string): void {
  const key = runnerKey(rundownId, packageId, providerId)
  const s = state()
  const running = s.get(key)
  if (!running) return
  if (running.restartTimer) clearTimeout(running.restartTimer)
  running.abort.abort()
  try {
    running.cleanup?.()
  } catch (err) {
    console.error(`[providers] cleanup threw for ${key}:`, err)
  }
  s.delete(key)
  setStatus(running, { state: 'stopped', message: null })
}

export function stopAllProvidersForPackage(rundownId: string, packageId: string): void {
  const pkg = getLoadedPackage(packageId)
  for (const def of pkg?.providers ?? []) {
    stopProvider(rundownId, packageId, def.id)
  }
}

export function stopAllProvidersForRundown(rundownId: string): void {
  for (const running of [...state().values()]) {
    if (running.rundownId === rundownId) stopProvider(rundownId, running.packageId, running.providerId)
  }
}

/** Stop + restart every running provider for a package/rundown (used on config change). */
export function restartProvidersIfNeeded(rundownId: string, packageId: string): void {
  const pkg = getLoadedPackage(packageId)
  for (const def of pkg?.providers ?? []) {
    const key = runnerKey(rundownId, packageId, def.id)
    const running = state().get(key)
    if (!running) continue
    if (def.restartOnConfigChange === false) continue
    stopProvider(rundownId, packageId, def.id)
    startProvider(rundownId, packageId, def.id)
  }
}

export function listProviderStatuses(rundownId: string): Array<{
  packageId: string
  providerId: string
  state: ProviderState
  message: string | null
  at: number
}> {
  const out: Array<{
    packageId: string
    providerId: string
    state: ProviderState
    message: string | null
    at: number
  }> = []
  for (const running of state().values()) {
    if (running.rundownId !== rundownId) continue
    out.push({
      packageId: running.packageId,
      providerId: running.providerId,
      state: running.status.state,
      message: running.status.message,
      at: running.status.at,
    })
  }
  return out
}

export function getProviderLogs(rundownId: string, packageId: string, providerId: string): string[] {
  return state().get(runnerKey(rundownId, packageId, providerId))?.logs ?? []
}

/** Resume autostart providers for every attached package across every rundown (server boot). */
export function startAllAttachedProviders(): void {
  for (const rundown of store.listRundowns()) {
    for (const attachment of store.listPackageAttachments(rundown.id, true)) {
      startAutostartProviders(rundown.id, attachment.packageId)
    }
  }
}

/** Test helper. */
export function resetProviders(): void {
  for (const running of [...state().values()]) {
    running.abort.abort()
    if (running.restartTimer) clearTimeout(running.restartTimer)
  }
  const g = globalThis as GlobalProviders
  g.__controllerProviders = undefined
}
