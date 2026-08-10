import {
  PROTOCOL_VERSION,
  ServerMessage,
  type ClientMessage,
  type ControlCommand,
  type ControlEvent,
  type ServerMessage as ServerMessageType,
} from '../protocol'
import type { ClientRole, ProtocolError, RundownSnapshot } from '../model'

export type ControlSocketStatus = 'connecting' | 'open' | 'reconnecting' | 'closed'

export type ControlSocketOptions = {
  url: string
  role: ClientRole
  rundownId: string
  instanceId?: string
  templateId?: string
  label?: string
  onStatus?: (status: ControlSocketStatus) => void
  onSnapshot?: (snapshot: RundownSnapshot) => void
  onEvent?: (seq: number, event: ControlEvent) => void
  onWelcome?: (sessionId: string) => void
  onError?: (error: ProtocolError) => void
}

type PendingCommand = {
  resolve: (value: { ok: true; events: ControlEvent[] } | { ok: false; error: ProtocolError }) => void
  timer: ReturnType<typeof setTimeout>
}

const ACK_TIMEOUT_MS = 10_000
const PING_INTERVAL_MS = 20_000
const MAX_BACKOFF_MS = 10_000

export type ControlSocket = {
  status: ControlSocketStatus
  sessionId: string | null
  sendCommand: (command: ControlCommand) => Promise<
    { ok: true; events: ControlEvent[] } | { ok: false; error: ProtocolError }
  >
  report: (input: {
    instanceId: string
    phase: import('../model').PlaybackPhase
    revision: number
    message?: string
  }) => void
  subscribe: (rundownId: string) => void
  close: () => void
}

export function createControlSocket(options: ControlSocketOptions): ControlSocket {
  let ws: WebSocket | null = null
  let status: ControlSocketStatus = 'connecting'
  let sessionId: string | null = null
  let closedIntentionally = false
  let attempt = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let pingTimer: ReturnType<typeof setInterval> | null = null
  const pending = new Map<string, PendingCommand>()
  const outboundQueue: ClientMessage[] = []

  const setStatus = (next: ControlSocketStatus) => {
    status = next
    options.onStatus?.(next)
  }

  const send = (msg: ClientMessage) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
    } else {
      outboundQueue.push(msg)
    }
  }

  const flushQueue = () => {
    while (outboundQueue.length > 0 && ws && ws.readyState === WebSocket.OPEN) {
      const msg = outboundQueue.shift()!
      ws.send(JSON.stringify(msg))
    }
  }

  const clearPing = () => {
    if (pingTimer) {
      clearInterval(pingTimer)
      pingTimer = null
    }
  }

  const startPing = () => {
    clearPing()
    pingTimer = setInterval(() => {
      send({ type: 'ping', id: crypto.randomUUID() })
    }, PING_INTERVAL_MS)
  }

  const handleServerMessage = (msg: ServerMessageType) => {
    switch (msg.type) {
      case 'welcome':
        sessionId = msg.sessionId
        options.onWelcome?.(msg.sessionId)
        break
      case 'snapshot':
        options.onSnapshot?.(msg.snapshot)
        break
      case 'event':
        options.onEvent?.(msg.seq, msg.event)
        break
      case 'ack': {
        const entry = pending.get(msg.commandId)
        if (!entry) break
        clearTimeout(entry.timer)
        pending.delete(msg.commandId)
        if (msg.ok) {
          entry.resolve({ ok: true, events: msg.events ?? [] })
        } else {
          entry.resolve({
            ok: false,
            error: msg.error ?? { code: 'ack_failed', message: 'Command failed' },
          })
        }
        break
      }
      case 'pong':
        break
      case 'error':
        options.onError?.(msg.error)
        break
    }
  }

  const connect = () => {
    if (closedIntentionally) return
    setStatus(attempt === 0 ? 'connecting' : 'reconnecting')

    const socket = new WebSocket(options.url)
    ws = socket

    socket.onopen = () => {
      attempt = 0
      setStatus('open')
      send({
        type: 'hello',
        role: options.role,
        rundownId: options.rundownId,
        instanceId: options.instanceId,
        templateId: options.templateId,
        label: options.label,
        protocolVersion: PROTOCOL_VERSION,
      })
      flushQueue()
      startPing()
    }

    socket.onmessage = (event) => {
      let raw: unknown
      try {
        raw = JSON.parse(String(event.data))
      } catch {
        options.onError?.({ code: 'invalid_json', message: 'Server sent non-JSON frame' })
        return
      }
      const parsed = ServerMessage.safeParse(raw)
      if (!parsed.success) {
        options.onError?.({
          code: 'invalid_message',
          message: 'Server sent unrecognized frame',
        })
        return
      }
      handleServerMessage(parsed.data)
    }

    socket.onclose = () => {
      clearPing()
      ws = null
      if (closedIntentionally) {
        setStatus('closed')
        return
      }
      setStatus('reconnecting')
      const delay = Math.min(MAX_BACKOFF_MS, 250 * 2 ** attempt)
      attempt += 1
      reconnectTimer = setTimeout(connect, delay)
    }

    socket.onerror = () => {
      // onclose will fire and schedule reconnect
    }
  }

  connect()

  return {
    get status() {
      return status
    },
    get sessionId() {
      return sessionId
    },
    sendCommand(command) {
      const commandId = crypto.randomUUID()
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          pending.delete(commandId)
          resolve({
            ok: false,
            error: { code: 'timeout', message: 'Command timed out waiting for ack' },
          })
        }, ACK_TIMEOUT_MS)
        pending.set(commandId, { resolve, timer })
        send({ type: 'command', commandId, command })
      })
    },
    report(input) {
      send({
        type: 'report',
        instanceId: input.instanceId,
        phase: input.phase,
        revision: input.revision,
        message: input.message,
      })
    },
    subscribe(rundownId) {
      send({ type: 'subscribe', rundownId })
    },
    close() {
      closedIntentionally = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      clearPing()
      for (const entry of pending.values()) {
        clearTimeout(entry.timer)
        entry.resolve({
          ok: false,
          error: { code: 'closed', message: 'Socket closed' },
        })
      }
      pending.clear()
      ws?.close()
      ws = null
      setStatus('closed')
    },
  }
}

export function defaultControlWsUrl(): string {
  if (typeof window === 'undefined') return 'ws://localhost:3000/api/control/ws'
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/api/control/ws`
}
