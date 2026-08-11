import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ControlCommand } from '../protocol'
import type { PlaybackPhase, ProtocolError } from '../model'
import type { TemplateTransition } from '#/templates/types'
import { acquireRundownStore, type RundownStoreState } from './store'
import type { ControlSocketStatus } from './socket'

export type LogLine = {
  id: string
  at: number
  kind: 'cmd' | 'ok' | 'err' | 'info'
  message: string
}

const LOG_LIMIT = 200

const EMPTY_STATE: RundownStoreState = {
  status: 'closed',
  sessionId: null,
  snapshot: null,
  rundown: null,
  instances: new Map(),
  renderers: new Map(),
  seq: 0,
  error: null,
  panicSeq: 0,
}

function pushLog(log: LogLine[], line: Omit<LogLine, 'id' | 'at'>): LogLine[] {
  const next = [...log, { ...line, id: crypto.randomUUID(), at: Date.now() }]
  return next.length > LOG_LIMIT ? next.slice(next.length - LOG_LIMIT) : next
}

type Acquired = ReturnType<typeof acquireRundownStore>

function useAcquiredStore(options: {
  enabled: boolean
  role: 'control' | 'renderer'
  rundownId: string
  instanceId?: string
  templateId?: string
  label?: string
}) {
  const { enabled, role, rundownId, instanceId, templateId, label } = options
  const [handle, setHandle] = useState<Acquired | null>(null)

  useEffect(() => {
    if (!enabled || !rundownId) {
      setHandle(null)
      return
    }
    const acquired = acquireRundownStore({ role, rundownId, instanceId, templateId, label })
    setHandle(acquired)
    return () => {
      acquired.release()
      setHandle((current) => (current === acquired ? null : current))
    }
  }, [enabled, role, rundownId, instanceId, templateId, label])

  const handleRef = useRef(handle)
  handleRef.current = handle

  const subscribe = useCallback((onStoreChange: () => void) => {
    const current = handleRef.current
    if (!current) return () => {}
    return current.subscribe(onStoreChange)
  }, [handle])

  const getSnapshot = useCallback(
    () => handleRef.current?.getState() ?? EMPTY_STATE,
    [handle],
  )

  const state = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_STATE)

  return { handle, state }
}

/**
 * Control-UI hook: subscribe to a rundown and expose typed command senders.
 */
export function useRundownController(rundownId: string | null | undefined) {
  const [log, setLog] = useState<LogLine[]>([])
  const { handle, state } = useAcquiredStore({
    enabled: Boolean(rundownId),
    role: 'control',
    rundownId: rundownId ?? '',
  })

  const send = useCallback(
    async (command: ControlCommand) => {
      if (!handle) {
        return { ok: false as const, error: { code: 'no_socket', message: 'Not connected' } }
      }
      setLog((prev) => pushLog(prev, { kind: 'cmd', message: command.type }))
      const result = await handle.socket.sendCommand(command)
      if (result.ok) {
        setLog((prev) => pushLog(prev, { kind: 'ok', message: `${command.type} ok` }))
      } else {
        setLog((prev) =>
          pushLog(prev, {
            kind: 'err',
            message: `${command.type}: ${result.error.message}`,
          }),
        )
      }
      return result
    },
    [handle],
  )

  const instances = [...state.instances.values()].sort((a, b) => a.sortOrder - b.sortOrder)

  return {
    status: state.status as ControlSocketStatus,
    sessionId: state.sessionId,
    snapshot: state.snapshot,
    rundown: state.rundown,
    instances,
    renderers: [...state.renderers.values()],
    panicSeq: state.panicSeq,
    error: state.error,
    log,
    clearLog: () => setLog([]),
    send,
    cue: (id: string) => send({ type: 'playout.cue', instanceId: id }),
    take: (id?: string) =>
      send({ type: 'playout.take', instanceId: id, rundownId: rundownId ?? undefined }),
    in: (id: string) => send({ type: 'playout.in', instanceId: id }),
    out: (id: string) => send({ type: 'playout.out', instanceId: id }),
    toggle: (id: string) => send({ type: 'playout.toggle', instanceId: id }),
    clearAll: () => send({ type: 'playout.clearAll', rundownId: rundownId! }),
    panic: () => send({ type: 'playout.panic', rundownId: rundownId! }),
    patchProps: (id: string, patch: Record<string, unknown>) =>
      send({ type: 'instance.patchProps', instanceId: id, patch }),
    replaceProps: (id: string, props: Record<string, unknown>) =>
      send({ type: 'instance.replaceProps', instanceId: id, props }),
    resetProps: (id: string) => send({ type: 'instance.resetProps', instanceId: id }),
    addInstance: (input: {
      templateId: string
      label?: string
      props?: Record<string, unknown>
      layer?: number
    }) =>
      send({
        type: 'instance.add',
        rundownId: rundownId!,
        templateId: input.templateId,
        label: input.label,
        props: input.props,
        layer: input.layer,
      }),
    removeInstance: (id: string) => send({ type: 'instance.remove', instanceId: id }),
    relabel: (id: string, nextLabel: string) =>
      send({ type: 'instance.relabel', instanceId: id, label: nextLabel }),
    reorder: (orderedIds: string[]) =>
      send({ type: 'instance.reorder', rundownId: rundownId!, orderedIds }),
  }
}

/**
 * Renderer-side hook for a single instance.
 */
export function useGraphicInstance(options: {
  rundownId: string | null | undefined
  instanceId: string | null | undefined
  templateId?: string
  label?: string
}) {
  const { rundownId, instanceId, templateId, label } = options
  const enabled = Boolean(rundownId && instanceId)

  const { handle, state } = useAcquiredStore({
    enabled,
    role: 'renderer',
    rundownId: rundownId ?? '',
    instanceId: instanceId ?? undefined,
    templateId,
    label,
  })

  const instance = instanceId ? (state.instances.get(instanceId) ?? null) : null

  const reportPhase = useCallback(
    (phase: PlaybackPhase, revision?: number, message?: string) => {
      if (!instanceId || !handle) return
      handle.socket.report({
        instanceId,
        phase,
        revision: revision ?? instance?.revision ?? 0,
        message,
      })
    },
    [instanceId, handle, instance?.revision],
  )

  const prevPanicSeq = useRef(state.panicSeq)
  useEffect(() => {
    if (state.panicSeq > prevPanicSeq.current) {
      reportPhase('offscreen', instance?.revision)
    }
    prevPanicSeq.current = state.panicSeq
  }, [state.panicSeq, instance?.revision, reportPhase])

  const sendCommand = useCallback(
    (command: ControlCommand) =>
      handle?.socket.sendCommand(command) ??
      Promise.resolve({
        ok: false as const,
        error: { code: 'no_socket', message: 'Not connected' },
      }),
    [handle],
  )

  return {
    status: state.status as ControlSocketStatus,
    instance,
    props: instance?.props ?? null,
    onScreen: instance?.playout.onScreen ?? false,
    revision: instance?.revision ?? 0,
    phase:
      [...state.renderers.values()].find((r) => r.instanceId === instanceId)?.phase ?? 'unknown',
    reportPhase,
    error: state.error as ProtocolError | null,
    sendCommand,
  }
}

/**
 * Infer playback phases from onScreen flips + template transition durations.
 */
export function usePlaybackReporter(options: {
  onScreen: boolean
  revision: number
  transition?: TemplateTransition
  report: (phase: PlaybackPhase, revision?: number) => void
  enabled?: boolean
}) {
  const { onScreen, revision, transition, report, enabled = true } = options
  const prevOnScreen = useRef<boolean | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled) return

    if (prevOnScreen.current === null) {
      prevOnScreen.current = onScreen
      report(onScreen ? 'onscreen' : 'offscreen', revision)
      return
    }

    if (prevOnScreen.current === onScreen) return
    prevOnScreen.current = onScreen

    if (timerRef.current) clearTimeout(timerRef.current)

    if (onScreen) {
      report('entering', revision)
      const ms = transition?.inMs ?? 500
      timerRef.current = setTimeout(() => report('onscreen', revision), ms)
    } else {
      report('exiting', revision)
      const ms = transition?.outMs ?? 400
      timerRef.current = setTimeout(() => report('offscreen', revision), ms)
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [onScreen, revision, transition?.inMs, transition?.outMs, report, enabled])
}
