import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { PROTOCOL_VERSION, parseClientMessage, parseControlCommand } from './protocol'
import { applyCommand } from './server/commands'
import { resetDbCache } from './server/db'
import { resetHub } from './server/hub'
import { resetSessions } from './server/sessions'
import * as store from './server/store'
import { buildSnapshot } from './server/snapshot'
import { aggregatePhase } from './model'

function resetAll() {
  resetDbCache()
  resetHub()
  resetSessions()
  process.env.CONTROLLER_DB = ':memory:'
}

describe('protocol', () => {
  test('parses valid commands', () => {
    const result = parseControlCommand({ type: 'playout.in', instanceId: 'abc' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.command.type).toBe('playout.in')
  })

  test('rejects invalid commands', () => {
    const result = parseControlCommand({ type: 'playout.in' })
    expect(result.ok).toBe(false)
  })

  test('parses hello client message', () => {
    const result = parseClientMessage({
      type: 'hello',
      role: 'renderer',
      rundownId: 'r1',
      instanceId: 'i1',
      protocolVersion: PROTOCOL_VERSION,
    })
    expect(result.ok).toBe(true)
  })
})

describe('commands + store', () => {
  beforeEach(() => {
    resetAll()
    // Force db open after env set
    store.listRundowns()
  })

  afterEach(() => {
    resetDbCache()
  })

  test('creates rundown and instance with validated props', () => {
    const created = applyCommand({ type: 'rundown.create', name: 'Show A' })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const added = applyCommand({
      type: 'instance.add',
      rundownId: created.rundownId!,
      templateId: 'labor-of-love-lower-third',
      props: { workerName: 'TEST', championshipName: 'TITLE' },
    })
    expect(added.ok).toBe(true)
    if (!added.ok) return

    const upsert = added.events.find((e) => e.type === 'instance.upserted')
    expect(upsert?.type).toBe('instance.upserted')
    if (upsert?.type !== 'instance.upserted') return
    expect(upsert.instance.props.workerName).toBe('TEST')
    expect(upsert.instance.revision).toBe(1)
    expect(upsert.instance.playout.onScreen).toBe(false)
  })

  test('rejects invalid props', () => {
    const created = applyCommand({ type: 'rundown.create', name: 'Show B' })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const added = applyCommand({
      type: 'instance.add',
      rundownId: created.rundownId!,
      templateId: 'labor-of-love-lower-third',
      props: { workerName: 123 } as unknown as Record<string, unknown>,
    })
    expect(added.ok).toBe(false)
    if (added.ok) return
    expect(added.error.code).toBe('invalid_props')
  })

  test('cue / take / clearAll transitions', () => {
    const created = applyCommand({ type: 'rundown.create', name: 'Show C' })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const rundownId = created.rundownId!

    const a = applyCommand({
      type: 'instance.add',
      rundownId,
      templateId: 'labor-of-love-lower-third',
      label: 'L3_A',
    })
    const b = applyCommand({
      type: 'instance.add',
      rundownId,
      templateId: 'labor-of-love-bracket',
      label: 'BRACKET_A',
    })
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return

    const instanceA = a.events.find((e) => e.type === 'instance.upserted')
    const instanceB = b.events.find((e) => e.type === 'instance.upserted')
    if (instanceA?.type !== 'instance.upserted' || instanceB?.type !== 'instance.upserted') {
      throw new Error('missing upsert events')
    }

    const cue = applyCommand({ type: 'playout.cue', instanceId: instanceA.instance.id })
    expect(cue.ok).toBe(true)
    expect(store.getRundown(rundownId)?.cuedInstanceId).toBe(instanceA.instance.id)

    const take = applyCommand({ type: 'playout.take', rundownId })
    expect(take.ok).toBe(true)
    expect(store.getInstance(instanceA.instance.id)?.playout.onScreen).toBe(true)
    expect(store.getRundown(rundownId)?.cuedInstanceId).toBeNull()

    applyCommand({ type: 'playout.in', instanceId: instanceB.instance.id })
    expect(store.getInstance(instanceB.instance.id)?.playout.onScreen).toBe(true)

    const clear = applyCommand({ type: 'playout.clearAll', rundownId })
    expect(clear.ok).toBe(true)
    expect(store.getInstance(instanceA.instance.id)?.playout.onScreen).toBe(false)
    expect(store.getInstance(instanceB.instance.id)?.playout.onScreen).toBe(false)
  })

  test('playout.panic clears on-air instances and emits panic event', () => {
    const created = applyCommand({ type: 'rundown.create', name: 'Show Panic' })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const rundownId = created.rundownId!

    const added = applyCommand({
      type: 'instance.add',
      rundownId,
      templateId: 'labor-of-love-lower-third',
      label: 'L3_PANIC',
    })
    expect(added.ok).toBe(true)
    if (!added.ok) return

    const upsert = added.events.find((e) => e.type === 'instance.upserted')
    if (upsert?.type !== 'instance.upserted') throw new Error('missing upsert')

    applyCommand({ type: 'playout.in', instanceId: upsert.instance.id })
    expect(store.getInstance(upsert.instance.id)?.playout.onScreen).toBe(true)

    const panicResult = applyCommand({ type: 'playout.panic', rundownId })
    expect(panicResult.ok).toBe(true)
    if (!panicResult.ok) return

    expect(panicResult.events[0]?.type).toBe('playout.panic')
    if (panicResult.events[0]?.type === 'playout.panic') {
      expect(panicResult.events[0].rundownId).toBe(rundownId)
    }
    expect(store.getInstance(upsert.instance.id)?.playout.onScreen).toBe(false)
  })

  test('patchProps bumps revision', () => {
    const created = applyCommand({ type: 'rundown.create', name: 'Show D' })
    if (!created.ok) throw new Error('create failed')
    const added = applyCommand({
      type: 'instance.add',
      rundownId: created.rundownId!,
      templateId: 'labor-of-love-lower-third',
    })
    if (!added.ok) throw new Error('add failed')
    const upsert = added.events.find((e) => e.type === 'instance.upserted')
    if (upsert?.type !== 'instance.upserted') throw new Error('no upsert')

    const before = upsert.instance.revision
    const patched = applyCommand({
      type: 'instance.patchProps',
      instanceId: upsert.instance.id,
      patch: { workerName: 'NEW NAME' },
    })
    expect(patched.ok).toBe(true)
    if (!patched.ok) return
    const propsEvent = patched.events.find((e) => e.type === 'instance.props')
    expect(propsEvent?.type).toBe('instance.props')
    if (propsEvent?.type !== 'instance.props') return
    expect(propsEvent.revision).toBe(before + 1)
    expect(propsEvent.props.workerName).toBe('NEW NAME')
  })

  test('buildSnapshot returns full rundown state', () => {
    const created = applyCommand({ type: 'rundown.create', name: 'Show E' })
    if (!created.ok) throw new Error('create failed')
    applyCommand({
      type: 'instance.add',
      rundownId: created.rundownId!,
      templateId: 'drexel-basketball-scorebug',
    })
    const snapshot = buildSnapshot(created.rundownId!)
    expect(snapshot).not.toBeNull()
    expect(snapshot!.instances).toHaveLength(1)
    expect(snapshot!.rundown.name).toBe('Show E')
  })

  test('setActive rundown pointer get/set and idempotent', () => {
    expect(store.getActiveRundownId()).toBeNull()

    const created = applyCommand({ type: 'rundown.create', name: 'Show Active' })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const rundownId = created.rundownId!

    const set = applyCommand({ type: 'rundown.setActive', rundownId })
    expect(set.ok).toBe(true)
    if (!set.ok) return
    expect(store.getActiveRundownId()).toBe(rundownId)
    const changed = set.events.find((e) => e.type === 'activeRundown.changed')
    expect(changed?.type).toBe('activeRundown.changed')
    if (changed?.type === 'activeRundown.changed') {
      expect(changed.rundownId).toBe(rundownId)
    }

    const again = applyCommand({ type: 'rundown.setActive', rundownId })
    expect(again.ok).toBe(true)
    if (!again.ok) return
    expect(again.events).toHaveLength(0)

    const missing = applyCommand({ type: 'rundown.setActive', rundownId: 'nope' })
    expect(missing.ok).toBe(false)
  })

  test('deleting active rundown clears the pointer', () => {
    const a = applyCommand({ type: 'rundown.create', name: 'A' })
    const b = applyCommand({ type: 'rundown.create', name: 'B' })
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return

    applyCommand({ type: 'rundown.setActive', rundownId: a.rundownId! })
    expect(store.getActiveRundownId()).toBe(a.rundownId)

    const deleted = applyCommand({ type: 'rundown.delete', rundownId: a.rundownId! })
    expect(deleted.ok).toBe(true)
    if (!deleted.ok) return
    expect(store.getActiveRundownId()).toBeNull()
    expect(deleted.events.some((e) => e.type === 'activeRundown.changed')).toBe(true)

    applyCommand({ type: 'rundown.setActive', rundownId: b.rundownId! })
    applyCommand({ type: 'rundown.delete', rundownId: a.rundownId! }) // already gone
    // deleting a non-active (already gone) shouldn't matter; B still active
    expect(store.getActiveRundownId()).toBe(b.rundownId)

    const delB = applyCommand({ type: 'rundown.delete', rundownId: b.rundownId! })
    expect(delB.ok).toBe(true)
    expect(store.getActiveRundownId()).toBeNull()
  })
})

describe('aggregatePhase', () => {
  test('unknown with no renderers', () => {
    expect(aggregatePhase([])).toBe('unknown')
  })

  test('entering wins over onscreen', () => {
    expect(
      aggregatePhase([
        {
          sessionId: '1',
          rundownId: 'r',
          instanceId: 'i',
          templateId: null,
          label: null,
          connectedAt: 0,
          lastSeenAt: 0,
          phase: 'onscreen',
          ackedRevision: 1,
          message: null,
        },
        {
          sessionId: '2',
          rundownId: 'r',
          instanceId: 'i',
          templateId: null,
          label: null,
          connectedAt: 0,
          lastSeenAt: 0,
          phase: 'entering',
          ackedRevision: 1,
          message: null,
        },
      ]),
    ).toBe('entering')
  })
})
