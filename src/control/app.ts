import { Hono } from 'hono'
import { upgradeWebSocket, websocket } from 'hono/bun'
import { listTemplatesPublic } from '#/templates/schemas'
import {
  PROTOCOL_VERSION,
  parseClientMessage,
  parseControlCommand,
  type ControlCommand,
  type ServerMessage,
} from '#/control/protocol'
import { applyCommand } from '#/control/server/commands'
import { buildSnapshot } from '#/control/server/snapshot'
import * as store from '#/control/server/store'
import { subscribe as hubSubscribe } from '#/control/server/hub'
import {
  createSession,
  listSessionsForRundown,
  removeSession,
  reportPhase,
  touchSession,
  type LiveSession,
} from '#/control/server/sessions'

export { websocket }

function jsonMessage(msg: ServerMessage): string {
  return JSON.stringify(msg)
}

// Fan hub events out to subscribed WebSocket sessions.
type GlobalWire = typeof globalThis & { __controllerHubUnsub?: () => void }
function ensureHubWired() {
  const g = globalThis as GlobalWire
  if (g.__controllerHubUnsub) return
  g.__controllerHubUnsub = hubSubscribe((seq, event, rundownId) => {
    const payload = jsonMessage({ type: 'event', seq, event })
    for (const session of listSessionsForRundown(rundownId)) {
      try {
        session.send(payload)
      } catch {
        // ignore broken sockets; close handler will clean up
      }
    }
  })
}
ensureHubWired()

const app = new Hono()

app.get('/api/control/health', (c) =>
  c.json({ ok: true, protocolVersion: PROTOCOL_VERSION, serverTime: Date.now() }),
)

app.get('/api/control/templates', (c) => c.json({ templates: listTemplatesPublic() }))

app.get('/api/control/rundowns', (c) => c.json({ rundowns: store.listRundowns() }))

app.post('/api/control/rundowns', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { name?: string }
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'Untitled'
  const result = applyCommand({ type: 'rundown.create', name })
  if (!result.ok) return c.json({ ok: false, error: result.error }, 400)
  const rundown = store.getRundown(result.rundownId!)
  return c.json({ ok: true, rundown, events: result.events }, 201)
})

app.get('/api/control/rundowns/:id', (c) => {
  const snapshot = buildSnapshot(c.req.param('id'))
  if (!snapshot) {
    return c.json({ ok: false, error: { code: 'not_found', message: 'Rundown not found' } }, 404)
  }
  return c.json({ ok: true, snapshot })
})

app.post('/api/control/rundowns/:id/commands', async (c) => {
  const rundownId = c.req.param('id')
  const rundown = store.getRundown(rundownId)
  if (!rundown) {
    return c.json({ ok: false, error: { code: 'not_found', message: 'Rundown not found' } }, 404)
  }

  const body = await c.req.json().catch(() => null)
  if (!body) {
    return c.json({ ok: false, error: { code: 'invalid_body', message: 'Expected JSON body' } }, 400)
  }

  const commands: unknown[] = Array.isArray((body as { commands?: unknown }).commands)
    ? (body as { commands: unknown[] }).commands
    : [(body as { command?: unknown }).command ?? body]

  const results: Array<{ ok: boolean; error?: unknown; events?: unknown }> = []
  for (const raw of commands) {
    const withRundown =
      raw && typeof raw === 'object'
        ? { rundownId, ...(raw as Record<string, unknown>) }
        : raw
    const parsed = parseControlCommand(withRundown)
    if (!parsed.ok) {
      results.push({ ok: false, error: parsed.error })
      continue
    }
    const command = injectRundownId(parsed.command, rundownId)
    const result = applyCommand(command)
    if (result.ok) results.push({ ok: true, events: result.events })
    else results.push({ ok: false, error: result.error })
  }

  const allOk = results.every((r) => r.ok)
  const snapshot = buildSnapshot(rundownId)
  return c.json({ ok: allOk, results, snapshot }, allOk ? 200 : 400)
})

function injectRundownId(command: ControlCommand, rundownId: string): ControlCommand {
  switch (command.type) {
    case 'instance.add':
      return { ...command, rundownId: command.rundownId || rundownId }
    case 'instance.reorder':
      return { ...command, rundownId: command.rundownId || rundownId }
    case 'playout.take':
      return { ...command, rundownId: command.rundownId || rundownId }
    case 'playout.clearAll':
      return { ...command, rundownId: command.rundownId || rundownId }
    case 'rundown.rename':
    case 'rundown.delete':
      return { ...command, rundownId: command.rundownId || rundownId }
    default:
      return command
  }
}

app.get(
  '/api/control/ws',
  upgradeWebSocket(() => {
    let session: LiveSession | null = null

    return {
      onMessage(event, ws) {
        let raw: unknown
        try {
          raw = JSON.parse(String(event.data))
        } catch {
          ws.send(
            jsonMessage({
              type: 'error',
              error: { code: 'invalid_json', message: 'Expected JSON frame' },
            }),
          )
          return
        }

        const parsed = parseClientMessage(raw)
        if (!parsed.ok) {
          ws.send(jsonMessage({ type: 'error', error: parsed.error }))
          return
        }

        const msg = parsed.message

        if (msg.type === 'ping') {
          if (session) touchSession(session.sessionId)
          ws.send(jsonMessage({ type: 'pong', id: msg.id }))
          return
        }

        if (msg.type === 'hello') {
          if (msg.protocolVersion !== PROTOCOL_VERSION) {
            ws.send(
              jsonMessage({
                type: 'error',
                error: {
                  code: 'protocol_mismatch',
                  message: `Expected protocol ${PROTOCOL_VERSION}, got ${msg.protocolVersion}`,
                },
              }),
            )
            return
          }

          if (session) removeSession(session.sessionId)

          session = createSession({
            role: msg.role,
            rundownId: msg.rundownId,
            instanceId: msg.instanceId,
            templateId: msg.templateId,
            label: msg.label,
            send: (data) => {
              try {
                ws.send(data)
              } catch {
                // socket closed
              }
            },
          })

          ws.send(
            jsonMessage({
              type: 'welcome',
              sessionId: session.sessionId,
              serverTime: Date.now(),
              protocolVersion: PROTOCOL_VERSION,
            }),
          )

          const snapshot = buildSnapshot(msg.rundownId)
          if (snapshot) ws.send(jsonMessage({ type: 'snapshot', snapshot }))
          return
        }

        if (!session) {
          ws.send(
            jsonMessage({
              type: 'error',
              error: { code: 'not_helloed', message: 'Send hello before other messages' },
            }),
          )
          return
        }

        touchSession(session.sessionId)

        if (msg.type === 'subscribe') {
          session.subscribed.add(msg.rundownId)
          const snapshot = buildSnapshot(msg.rundownId)
          if (snapshot) ws.send(jsonMessage({ type: 'snapshot', snapshot }))
          return
        }

        if (msg.type === 'unsubscribe') {
          session.subscribed.delete(msg.rundownId)
          return
        }

        if (msg.type === 'report') {
          reportPhase(session.sessionId, {
            instanceId: msg.instanceId,
            phase: msg.phase,
            revision: msg.revision,
            message: msg.message,
          })
          return
        }

        if (msg.type === 'command') {
          const result = applyCommand(msg.command)
          ws.send(
            jsonMessage(
              result.ok
                ? {
                    type: 'ack',
                    commandId: msg.commandId,
                    ok: true,
                    events: result.events,
                  }
                : {
                    type: 'ack',
                    commandId: msg.commandId,
                    ok: false,
                    error: result.error,
                  },
            ),
          )
        }
      },
      onClose() {
        if (session) {
          removeSession(session.sessionId)
          session = null
        }
      },
    }
  }),
)

export { app }
export default app
