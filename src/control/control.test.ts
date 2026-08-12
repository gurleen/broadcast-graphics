import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { z } from 'zod'
import { PROTOCOL_VERSION, parseClientMessage, parseControlCommand } from './protocol'
import { applyCommand } from './server/commands'
import { resetDbCache } from './server/db'
import { resetHub } from './server/hub'
import { resetSessions } from './server/sessions'
import * as store from './server/store'
import { buildSnapshot } from './server/snapshot'
import { aggregatePhase } from './model'
import { registerTestPackage, resetPackagesCache, type LoadedPackage } from './server/packages'
import { resetProviders } from './server/providers'
import { resetDatasetCache } from './server/datasets'

function resetAll() {
  resetDbCache()
  resetHub()
  resetSessions()
  resetPackagesCache()
  resetProviders()
  resetDatasetCache()
  store.resetLiveDataCache()
  process.env.CONTROLLER_DB = ':memory:'
}

const TEST_PACKAGE_ID = 'test-pkg'
const TEST_TEMPLATE_ID = 'test-pkg-scoreboard'

function testPackage(overrides: Partial<LoadedPackage> = {}): LoadedPackage {
  return {
    id: TEST_PACKAGE_ID,
    name: 'Test Package',
    version: '1.0.0',
    contentHash: 'testhash',
    formatVersion: 1,
    filePath: '/virtual/test-pkg.hgfx.js',
    bundleUrl: `/api/control/packages/${TEST_PACKAGE_ID}/bundle.js`,
    error: null,
    config: {
      schema: z.object({ multiplier: z.number() }),
      defaults: { multiplier: 1 },
    },
    dataSchemas: { game: z.object({ score: z.number() }) },
    templates: [
      {
        id: TEST_TEMPLATE_ID,
        name: 'Test Scoreboard',
        route: `/graphics/p/${TEST_PACKAGE_ID}/${TEST_TEMPLATE_ID}`,
        schema: z.object({ score: z.number() }),
        defaults: { score: 0 },
        packageId: TEST_PACKAGE_ID,
        live: { bind: { score: 'data.game.score' } },
      },
    ],
    ...overrides,
  }
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
    // Take must not clear the cue — PVW stays bound to the cued instance.
    expect(store.getRundown(rundownId)?.cuedInstanceId).toBe(instanceA.instance.id)

    applyCommand({ type: 'playout.in', instanceId: instanceB.instance.id })
    expect(store.getInstance(instanceB.instance.id)?.playout.onScreen).toBe(true)

    const clear = applyCommand({ type: 'playout.clearAll', rundownId })
    expect(clear.ok).toBe(true)
    expect(store.getInstance(instanceA.instance.id)?.playout.onScreen).toBe(false)
    expect(store.getInstance(instanceB.instance.id)?.playout.onScreen).toBe(false)
    expect(store.getRundown(rundownId)?.cuedInstanceId).toBe(instanceA.instance.id)
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

    applyCommand({ type: 'playout.cue', instanceId: upsert.instance.id })
    applyCommand({ type: 'playout.in', instanceId: upsert.instance.id })
    expect(store.getInstance(upsert.instance.id)?.playout.onScreen).toBe(true)
    expect(store.getRundown(rundownId)?.cuedInstanceId).toBe(upsert.instance.id)

    const panicResult = applyCommand({ type: 'playout.panic', rundownId })
    expect(panicResult.ok).toBe(true)
    if (!panicResult.ok) return

    expect(panicResult.events[0]?.type).toBe('playout.panic')
    if (panicResult.events[0]?.type === 'playout.panic') {
      expect(panicResult.events[0].rundownId).toBe(rundownId)
    }
    expect(store.getInstance(upsert.instance.id)?.playout.onScreen).toBe(false)
    // Panic is PGM-only — cue / PVW pointer must remain.
    expect(store.getRundown(rundownId)?.cuedInstanceId).toBe(upsert.instance.id)
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

  test('creates rundowns in sort order and reorders them', () => {
    const a = applyCommand({ type: 'rundown.create', name: 'A' })
    const b = applyCommand({ type: 'rundown.create', name: 'B' })
    const c = applyCommand({ type: 'rundown.create', name: 'C' })
    expect(a.ok && b.ok && c.ok).toBe(true)
    if (!a.ok || !b.ok || !c.ok) return

    const listed = store.listRundowns()
    expect(listed.map((r) => r.name)).toEqual(['A', 'B', 'C'])
    expect(listed.map((r) => r.sortOrder)).toEqual([0, 1, 2])

    const reordered = applyCommand({
      type: 'rundown.reorder',
      orderedIds: [c.rundownId!, a.rundownId!, b.rundownId!],
    })
    expect(reordered.ok).toBe(true)
    if (!reordered.ok) return
    expect(reordered.events.every((e) => e.type === 'rundown.upserted')).toBe(true)

    const after = store.listRundowns()
    expect(after.map((r) => r.name)).toEqual(['C', 'A', 'B'])
    expect(after.map((r) => r.sortOrder)).toEqual([0, 1, 2])

    const renamed = applyCommand({
      type: 'rundown.rename',
      rundownId: a.rundownId!,
      name: 'Alpha',
    })
    expect(renamed.ok).toBe(true)
    expect(store.getRundown(a.rundownId!)?.name).toBe('Alpha')
  })
})

describe('live data subsystem', () => {
  beforeEach(() => {
    resetAll()
    store.listRundowns()
    registerTestPackage(testPackage())
  })

  afterEach(() => {
    resetDbCache()
    resetPackagesCache()
    resetProviders()
  })

  test('attaches a package with default config', () => {
    const created = applyCommand({ type: 'rundown.create', name: 'Live A' })
    if (!created.ok) throw new Error('create failed')
    const rundownId = created.rundownId!

    const attached = applyCommand({
      type: 'rundown.attachPackage',
      rundownId,
      packageId: TEST_PACKAGE_ID,
    })
    expect(attached.ok).toBe(true)
    if (!attached.ok) return
    const event = attached.events.find((e) => e.type === 'rundown.package')
    expect(event?.type).toBe('rundown.package')
    if (event?.type !== 'rundown.package') return
    expect(event.attached).toBe(true)
    expect(event.config).toEqual({ multiplier: 1 })

    const snapshot = buildSnapshot(rundownId)
    expect(snapshot?.packages).toHaveLength(1)
    expect(snapshot?.packages[0]?.packageId).toBe(TEST_PACKAGE_ID)
  })

  test('rejects attaching an unknown package', () => {
    const created = applyCommand({ type: 'rundown.create', name: 'Live B' })
    if (!created.ok) throw new Error('create failed')
    const result = applyCommand({
      type: 'rundown.attachPackage',
      rundownId: created.rundownId!,
      packageId: 'does-not-exist',
    })
    expect(result.ok).toBe(false)
  })

  test('rejects invalid package config', () => {
    const created = applyCommand({ type: 'rundown.create', name: 'Live C' })
    if (!created.ok) throw new Error('create failed')
    const result = applyCommand({
      type: 'rundown.attachPackage',
      rundownId: created.rundownId!,
      packageId: TEST_PACKAGE_ID,
      config: { multiplier: 'not-a-number' },
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('invalid_config')
  })

  test('instance.add auto-attaches the owning package', () => {
    const created = applyCommand({ type: 'rundown.create', name: 'Live D' })
    if (!created.ok) throw new Error('create failed')
    const rundownId = created.rundownId!

    const added = applyCommand({
      type: 'instance.add',
      rundownId,
      templateId: TEST_TEMPLATE_ID,
    })
    expect(added.ok).toBe(true)
    if (!added.ok) return
    const attachEvent = added.events.find((e) => e.type === 'rundown.package')
    expect(attachEvent?.type).toBe('rundown.package')

    expect(store.getPackageAttachment(rundownId, TEST_PACKAGE_ID)?.attached).toBe(true)
  })

  test('patchConfig merges and validates', () => {
    const created = applyCommand({ type: 'rundown.create', name: 'Live E' })
    if (!created.ok) throw new Error('create failed')
    const rundownId = created.rundownId!
    applyCommand({ type: 'rundown.attachPackage', rundownId, packageId: TEST_PACKAGE_ID })

    const patched = applyCommand({
      type: 'rundown.patchConfig',
      rundownId,
      packageId: TEST_PACKAGE_ID,
      patch: { multiplier: 2 },
    })
    expect(patched.ok).toBe(true)
    expect(store.getPackageAttachment(rundownId, TEST_PACKAGE_ID)?.config).toEqual({
      multiplier: 2,
    })

    const rejected = applyCommand({
      type: 'rundown.patchConfig',
      rundownId,
      packageId: TEST_PACKAGE_ID,
      patch: { multiplier: 'nope' },
    })
    expect(rejected.ok).toBe(false)
  })

  test('data.publish projects bound props into the live overlay without persisting', () => {
    const created = applyCommand({ type: 'rundown.create', name: 'Live F' })
    if (!created.ok) throw new Error('create failed')
    const rundownId = created.rundownId!
    applyCommand({ type: 'rundown.attachPackage', rundownId, packageId: TEST_PACKAGE_ID })

    const added = applyCommand({
      type: 'instance.add',
      rundownId,
      templateId: TEST_TEMPLATE_ID,
    })
    if (!added.ok) throw new Error('add failed')
    const upsert = added.events.find((e) => e.type === 'instance.upserted')
    if (upsert?.type !== 'instance.upserted') throw new Error('no upsert')
    const instanceId = upsert.instance.id

    const published = applyCommand({
      type: 'data.publish',
      rundownId,
      packageId: TEST_PACKAGE_ID,
      key: 'game',
      value: { score: 7 },
    })
    expect(published.ok).toBe(true)

    const effective = store.getInstance(instanceId)
    expect(effective?.props.score).toBe(7)

    // The projected value must never hit SQLite — raw props stay at the default.
    const raw = store
      .listInstances(rundownId)
      .find((i) => i.id === instanceId)
    expect(raw?.props.score).toBe(7) // merged view via store helpers always includes overlay

    const snapshot = buildSnapshot(rundownId)
    const dataRecord = snapshot?.data.find((d) => d.packageId === TEST_PACKAGE_ID && d.key === 'game')
    expect(dataRecord?.value).toEqual({ score: 7 })
  })

  test('data.publish rejects values that fail the declared schema', () => {
    const created = applyCommand({ type: 'rundown.create', name: 'Live G' })
    if (!created.ok) throw new Error('create failed')
    const rundownId = created.rundownId!
    applyCommand({ type: 'rundown.attachPackage', rundownId, packageId: TEST_PACKAGE_ID })

    const result = applyCommand({
      type: 'data.publish',
      rundownId,
      packageId: TEST_PACKAGE_ID,
      key: 'game',
      value: { score: 'not-a-number' },
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('invalid_data')
  })

  test('data.publish requires the package to be attached', () => {
    const created = applyCommand({ type: 'rundown.create', name: 'Live H' })
    if (!created.ok) throw new Error('create failed')
    const result = applyCommand({
      type: 'data.publish',
      rundownId: created.rundownId!,
      packageId: TEST_PACKAGE_ID,
      key: 'game',
      value: { score: 1 },
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('not_attached')
  })

  test('detachPackage stops providers and detaches', () => {
    const created = applyCommand({ type: 'rundown.create', name: 'Live I' })
    if (!created.ok) throw new Error('create failed')
    const rundownId = created.rundownId!
    applyCommand({ type: 'rundown.attachPackage', rundownId, packageId: TEST_PACKAGE_ID })
    expect(store.getPackageAttachment(rundownId, TEST_PACKAGE_ID)?.attached).toBe(true)

    const detached = applyCommand({
      type: 'rundown.detachPackage',
      rundownId,
      packageId: TEST_PACKAGE_ID,
    })
    expect(detached.ok).toBe(true)
    expect(store.getPackageAttachment(rundownId, TEST_PACKAGE_ID)?.attached).toBe(false)
  })

  test('rundown.delete cleans up live data and overlay state', () => {
    const created = applyCommand({ type: 'rundown.create', name: 'Live J' })
    if (!created.ok) throw new Error('create failed')
    const rundownId = created.rundownId!
    applyCommand({ type: 'rundown.attachPackage', rundownId, packageId: TEST_PACKAGE_ID })
    applyCommand({
      type: 'data.publish',
      rundownId,
      packageId: TEST_PACKAGE_ID,
      key: 'game',
      value: { score: 3 },
    })

    const deleted = applyCommand({ type: 'rundown.delete', rundownId })
    expect(deleted.ok).toBe(true)
    expect(store.listRundownData(rundownId)).toHaveLength(0)
  })
})

describe('providers', () => {
  beforeEach(() => {
    resetAll()
    store.listRundowns()
  })

  afterEach(() => {
    resetDbCache()
    resetPackagesCache()
    resetProviders()
  })

  test('autostart provider publishes data and can be stopped on detach', async () => {
    registerTestPackage(
      testPackage({
        providers: [
          {
            id: 'ticker',
            name: 'Ticker',
            publishes: ['game'],
            autostart: true,
            start: (ctx) => {
              ctx.publish('game', { score: 42 })
              return () => {}
            },
          },
        ],
      }),
    )

    const created = applyCommand({ type: 'rundown.create', name: 'Providers A' })
    if (!created.ok) throw new Error('create failed')
    const rundownId = created.rundownId!

    applyCommand({ type: 'rundown.attachPackage', rundownId, packageId: TEST_PACKAGE_ID })

    // Provider runs asynchronously — give the microtask queue a tick.
    await Promise.resolve()
    await Promise.resolve()

    expect(store.getRundownDataValue(rundownId, TEST_PACKAGE_ID, 'game')).toEqual({ score: 42 })

    const running = buildSnapshot(rundownId)?.providers.find((p) => p.providerId === 'ticker')
    expect(running?.state).toBe('ok')

    const detached = applyCommand({
      type: 'rundown.detachPackage',
      rundownId,
      packageId: TEST_PACKAGE_ID,
    })
    expect(detached.ok).toBe(true)
  })

  test('provider.start / provider.stop control a non-autostart feed', async () => {
    registerTestPackage(
      testPackage({
        providers: [
          {
            id: 'manual',
            name: 'Manual',
            publishes: ['game'],
            autostart: false,
            start: (ctx) => {
              ctx.publish('game', { score: 7 })
              return () => {}
            },
          },
        ],
      }),
    )

    const created = applyCommand({ type: 'rundown.create', name: 'Providers Manual' })
    if (!created.ok) throw new Error('create failed')
    const rundownId = created.rundownId!

    applyCommand({ type: 'rundown.attachPackage', rundownId, packageId: TEST_PACKAGE_ID })
    await Promise.resolve()
    expect(store.getRundownDataValue(rundownId, TEST_PACKAGE_ID, 'game')).toBeUndefined()

    const started = applyCommand({
      type: 'provider.start',
      rundownId,
      packageId: TEST_PACKAGE_ID,
      providerId: 'manual',
    })
    expect(started.ok).toBe(true)
    await Promise.resolve()
    await Promise.resolve()

    expect(store.getRundownDataValue(rundownId, TEST_PACKAGE_ID, 'game')).toEqual({ score: 7 })
    expect(buildSnapshot(rundownId)?.providers.find((p) => p.providerId === 'manual')?.state).toBe(
      'ok',
    )

    const stopped = applyCommand({
      type: 'provider.stop',
      rundownId,
      packageId: TEST_PACKAGE_ID,
      providerId: 'manual',
    })
    expect(stopped.ok).toBe(true)
    expect(
      buildSnapshot(rundownId)?.providers.find((p) => p.providerId === 'manual'),
    ).toBeUndefined()
  })

  test('a crashing provider does not throw and is marked errored', async () => {
    registerTestPackage(
      testPackage({
        providers: [
          {
            id: 'flaky',
            name: 'Flaky',
            autostart: true,
            start: () => {
              throw new Error('boom')
            },
          },
        ],
      }),
    )

    const created = applyCommand({ type: 'rundown.create', name: 'Providers B' })
    if (!created.ok) throw new Error('create failed')
    const rundownId = created.rundownId!

    expect(() =>
      applyCommand({ type: 'rundown.attachPackage', rundownId, packageId: TEST_PACKAGE_ID }),
    ).not.toThrow()

    await Promise.resolve()
    await Promise.resolve()

    const snapshot = buildSnapshot(rundownId)
    const status = snapshot?.providers.find((p) => p.providerId === 'flaky')
    expect(status?.state).toBe('error')
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
