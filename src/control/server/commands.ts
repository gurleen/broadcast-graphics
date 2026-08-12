import { getTemplatePackageId, getTemplateSchema } from '#/templates/schemas'
import type { ControlCommand, ControlEvent } from '../protocol'
import type { ProtocolError } from '../model'
import * as store from './store'
import { publish, publishMany } from './hub'
import { deepMerge } from './util'
import { getLoadedPackage } from './packages'
import { recomputeRundownProjection } from './projector'
import {
  restartProvidersIfNeeded,
  startAutostartProviders,
  stopAllProvidersForPackage,
  stopAllProvidersForRundown,
} from './providers'

export type CommandResult =
  | { ok: true; events: ControlEvent[]; rundownId: string | null }
  | { ok: false; error: ProtocolError }

function err(code: string, message: string): CommandResult {
  return { ok: false, error: { code, message } }
}

/** Attach a package (idempotent) and start its autostart providers. */
function ensurePackageAttached(
  rundownId: string,
  packageId: string,
  config?: Record<string, unknown>,
): ControlEvent | null {
  const existing = store.getPackageAttachment(rundownId, packageId)
  if (existing?.attached) return null
  const pkg = getLoadedPackage(packageId)
  const nextConfig = config ?? existing?.config ?? (pkg?.config?.defaults as Record<string, unknown> | undefined) ?? {}
  const attachment = store.attachPackage(rundownId, packageId, nextConfig)
  startAutostartProviders(rundownId, packageId)
  return {
    type: 'rundown.package',
    rundownId,
    packageId,
    attached: true,
    config: attachment.config,
  }
}

function defaultLabel(templateId: string, existingCount: number): string {
  const short = templateId
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .toUpperCase()
  return `${short}_${String(existingCount + 1).padStart(3, '0')}`
}

/**
 * Apply a control command. Persists durable changes and returns events to fan out.
 * Does not publish itself — the caller (WS / REST) publishes via the hub.
 */
export function applyCommand(command: ControlCommand): CommandResult {
  switch (command.type) {
    case 'rundown.create': {
      const rundown = store.createRundown(command.name)
      const events: ControlEvent[] = [{ type: 'rundown.upserted', rundown }]
      publishMany(rundown.id, events)
      return { ok: true, events, rundownId: rundown.id }
    }

    case 'rundown.rename': {
      const rundown = store.renameRundown(command.rundownId, command.name)
      if (!rundown) return err('not_found', `Rundown ${command.rundownId} not found`)
      const events: ControlEvent[] = [{ type: 'rundown.upserted', rundown }]
      publishMany(rundown.id, events)
      return { ok: true, events, rundownId: rundown.id }
    }

    case 'rundown.delete': {
      const existing = store.getRundown(command.rundownId)
      if (!existing) return err('not_found', `Rundown ${command.rundownId} not found`)
      const wasActive = store.getActiveRundownId() === command.rundownId
      const instanceIds = store.listInstances(command.rundownId).map((i) => i.id)
      stopAllProvidersForRundown(command.rundownId)
      store.deleteRundown(command.rundownId)
      for (const id of instanceIds) store.clearLiveOverlay(id)
      store.clearRundownDataAll(command.rundownId)
      const events: ControlEvent[] = [
        { type: 'rundown.removed', rundownId: command.rundownId },
      ]
      publishMany(command.rundownId, events)
      if (wasActive) {
        store.setActiveRundownId(null)
        const clearEvent: ControlEvent = { type: 'activeRundown.changed', rundownId: null }
        publish('*', clearEvent)
        events.push(clearEvent)
      }
      return { ok: true, events, rundownId: command.rundownId }
    }

    case 'rundown.reorder': {
      const existing = store.listRundowns()
      const existingIds = new Set(existing.map((r) => r.id))
      if (command.orderedIds.length !== existing.length) {
        return err('invalid_order', 'orderedIds must include every rundown exactly once')
      }
      for (const id of command.orderedIds) {
        if (!existingIds.has(id)) {
          return err('not_found', `Rundown ${id} not found`)
        }
      }
      if (new Set(command.orderedIds).size !== command.orderedIds.length) {
        return err('invalid_order', 'orderedIds must not contain duplicates')
      }
      const rundowns = store.reorderRundowns(command.orderedIds)
      const events: ControlEvent[] = rundowns.map((rundown) => ({
        type: 'rundown.upserted' as const,
        rundown,
      }))
      for (const event of events) {
        if (event.type === 'rundown.upserted') {
          publish(event.rundown.id, event)
        }
      }
      return { ok: true, events, rundownId: null }
    }

    case 'rundown.setActive': {
      if (command.rundownId !== null) {
        const rundown = store.getRundown(command.rundownId)
        if (!rundown) return err('not_found', `Rundown ${command.rundownId} not found`)
      }
      const current = store.getActiveRundownId()
      if (current === command.rundownId) {
        return { ok: true, events: [], rundownId: command.rundownId }
      }
      store.setActiveRundownId(command.rundownId)
      const events: ControlEvent[] = [
        { type: 'activeRundown.changed', rundownId: command.rundownId },
      ]
      publishMany('*', events)
      return { ok: true, events, rundownId: command.rundownId }
    }

    case 'instance.add': {
      const rundown = store.getRundown(command.rundownId)
      if (!rundown) return err('not_found', `Rundown ${command.rundownId} not found`)

      const template = getTemplateSchema(command.templateId)
      if (!template) return err('unknown_template', `Template ${command.templateId} not found`)

      const baseProps = {
        ...(template.defaults as Record<string, unknown>),
        ...(command.props ?? {}),
      }
      const parsed = template.schema.safeParse(baseProps)
      if (!parsed.success) {
        return err(
          'invalid_props',
          parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        )
      }

      const existing = store.listInstances(command.rundownId)
      const label = command.label ?? defaultLabel(command.templateId, existing.length)
      const instance = store.createInstance({
        rundownId: command.rundownId,
        templateId: command.templateId,
        label,
        props: parsed.data as Record<string, unknown>,
        layer: command.layer,
      })
      const events: ControlEvent[] = [{ type: 'instance.upserted', instance }]

      // Adding an instance opts the rundown into the template's owning package.
      const packageId = getTemplatePackageId(command.templateId)
      if (packageId) {
        const attachEvent = ensurePackageAttached(command.rundownId, packageId)
        if (attachEvent) events.push(attachEvent)
      }

      publishMany(command.rundownId, events)
      recomputeRundownProjection(command.rundownId)
      return { ok: true, events, rundownId: command.rundownId }
    }

    case 'instance.remove': {
      const existing = store.getInstance(command.instanceId)
      if (!existing) return err('not_found', `Instance ${command.instanceId} not found`)
      store.deleteInstance(command.instanceId)
      store.clearLiveOverlay(command.instanceId)
      const events: ControlEvent[] = [
        {
          type: 'instance.removed',
          instanceId: command.instanceId,
          rundownId: existing.rundownId,
        },
      ]
      // Cue clear may have updated the rundown.
      const rundown = store.getRundown(existing.rundownId)
      if (rundown) events.push({ type: 'rundown.upserted', rundown })
      publishMany(existing.rundownId, events)
      return { ok: true, events, rundownId: existing.rundownId }
    }

    case 'instance.relabel': {
      const instance = store.updateInstanceLabel(command.instanceId, command.label)
      if (!instance) return err('not_found', `Instance ${command.instanceId} not found`)
      const events: ControlEvent[] = [{ type: 'instance.upserted', instance }]
      publishMany(instance.rundownId, events)
      return { ok: true, events, rundownId: instance.rundownId }
    }

    case 'instance.reorder': {
      const rundown = store.getRundown(command.rundownId)
      if (!rundown) return err('not_found', `Rundown ${command.rundownId} not found`)
      const instances = store.reorderInstances(command.rundownId, command.orderedIds)
      const events: ControlEvent[] = instances.map((instance) => ({
        type: 'instance.upserted' as const,
        instance,
      }))
      publishMany(command.rundownId, events)
      return { ok: true, events, rundownId: command.rundownId }
    }

    case 'instance.patchProps': {
      const existing = store.getInstance(command.instanceId)
      if (!existing) return err('not_found', `Instance ${command.instanceId} not found`)
      const template = getTemplateSchema(existing.templateId)
      if (!template) return err('unknown_template', `Template ${existing.templateId} not found`)

      const merged = deepMerge(existing.props, command.patch)
      const parsed = template.schema.safeParse(merged)
      if (!parsed.success) {
        return err(
          'invalid_props',
          parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        )
      }

      const instance = store.updateInstanceProps(
        command.instanceId,
        parsed.data as Record<string, unknown>,
      )!
      const events: ControlEvent[] = [
        {
          type: 'instance.props',
          instanceId: instance.id,
          rundownId: instance.rundownId,
          patch: command.patch,
          props: instance.props,
          revision: instance.revision,
        },
      ]
      publishMany(instance.rundownId, events)
      return { ok: true, events, rundownId: instance.rundownId }
    }

    case 'instance.replaceProps': {
      const existing = store.getInstance(command.instanceId)
      if (!existing) return err('not_found', `Instance ${command.instanceId} not found`)
      const template = getTemplateSchema(existing.templateId)
      if (!template) return err('unknown_template', `Template ${existing.templateId} not found`)

      const parsed = template.schema.safeParse(command.props)
      if (!parsed.success) {
        return err(
          'invalid_props',
          parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        )
      }

      const instance = store.updateInstanceProps(
        command.instanceId,
        parsed.data as Record<string, unknown>,
      )!
      const events: ControlEvent[] = [
        {
          type: 'instance.props',
          instanceId: instance.id,
          rundownId: instance.rundownId,
          patch: command.props,
          props: instance.props,
          revision: instance.revision,
        },
        { type: 'instance.upserted', instance },
      ]
      publishMany(instance.rundownId, events)
      return { ok: true, events, rundownId: instance.rundownId }
    }

    case 'instance.resetProps': {
      const existing = store.getInstance(command.instanceId)
      if (!existing) return err('not_found', `Instance ${command.instanceId} not found`)
      const template = getTemplateSchema(existing.templateId)
      if (!template) return err('unknown_template', `Template ${existing.templateId} not found`)

      const instance = store.updateInstanceProps(
        command.instanceId,
        template.defaults as Record<string, unknown>,
      )!
      const events: ControlEvent[] = [
        {
          type: 'instance.props',
          instanceId: instance.id,
          rundownId: instance.rundownId,
          patch: instance.props,
          props: instance.props,
          revision: instance.revision,
        },
        { type: 'instance.upserted', instance },
      ]
      publishMany(instance.rundownId, events)
      return { ok: true, events, rundownId: instance.rundownId }
    }

    case 'playout.cue': {
      const existing = store.getInstance(command.instanceId)
      if (!existing) return err('not_found', `Instance ${command.instanceId} not found`)
      const rundown = store.setCuedInstance(existing.rundownId, command.instanceId)
      if (!rundown) return err('not_found', `Rundown ${existing.rundownId} not found`)

      const instances = store.listInstances(existing.rundownId)
      const events: ControlEvent[] = [
        { type: 'rundown.upserted', rundown },
        ...instances.map((instance) => ({
          type: 'playout.changed' as const,
          instanceId: instance.id,
          rundownId: instance.rundownId,
          playout: instance.playout,
          revision: instance.revision,
          rundown,
        })),
      ]
      publishMany(existing.rundownId, events)
      return { ok: true, events, rundownId: existing.rundownId }
    }

    case 'playout.take': {
      let instanceId = command.instanceId
      let rundownId = command.rundownId

      if (!instanceId) {
        if (!rundownId) return err('invalid_command', 'playout.take requires instanceId or rundownId')
        const rundown = store.getRundown(rundownId)
        if (!rundown) return err('not_found', `Rundown ${rundownId} not found`)
        if (!rundown.cuedInstanceId) {
          return err('no_cue', 'No instance is cued')
        }
        instanceId = rundown.cuedInstanceId
      }

      const existing = store.getInstance(instanceId)
      if (!existing) return err('not_found', `Instance ${instanceId} not found`)
      rundownId = existing.rundownId

      // Take to PGM only — keep cuedInstanceId so PVW stays bound to the cue.
      const instance = store.setInstanceOnScreen(instanceId, true)!

      const events: ControlEvent[] = [
        {
          type: 'playout.changed',
          instanceId: instance.id,
          rundownId,
          playout: instance.playout,
          revision: instance.revision,
        },
        { type: 'instance.upserted', instance },
      ]
      publishMany(rundownId, events)
      return { ok: true, events, rundownId }
    }

    case 'playout.in': {
      const instance = store.setInstanceOnScreen(command.instanceId, true)
      if (!instance) return err('not_found', `Instance ${command.instanceId} not found`)
      const events: ControlEvent[] = [
        {
          type: 'playout.changed',
          instanceId: instance.id,
          rundownId: instance.rundownId,
          playout: instance.playout,
          revision: instance.revision,
        },
        { type: 'instance.upserted', instance },
      ]
      publishMany(instance.rundownId, events)
      return { ok: true, events, rundownId: instance.rundownId }
    }

    case 'playout.out': {
      const instance = store.setInstanceOnScreen(command.instanceId, false)
      if (!instance) return err('not_found', `Instance ${command.instanceId} not found`)
      const events: ControlEvent[] = [
        {
          type: 'playout.changed',
          instanceId: instance.id,
          rundownId: instance.rundownId,
          playout: instance.playout,
          revision: instance.revision,
        },
        { type: 'instance.upserted', instance },
      ]
      publishMany(instance.rundownId, events)
      return { ok: true, events, rundownId: instance.rundownId }
    }

    case 'playout.toggle': {
      const existing = store.getInstance(command.instanceId)
      if (!existing) return err('not_found', `Instance ${command.instanceId} not found`)
      return applyCommand({
        type: existing.playout.onScreen ? 'playout.out' : 'playout.in',
        instanceId: command.instanceId,
      })
    }

    case 'playout.clearAll': {
      const rundown = store.getRundown(command.rundownId)
      if (!rundown) return err('not_found', `Rundown ${command.rundownId} not found`)
      const before = store.listInstances(command.rundownId)
      const onAir = before.filter((i) => i.playout.onScreen)
      store.clearAllOnScreen(command.rundownId)
      const after = store.listInstances(command.rundownId)
      const events: ControlEvent[] = after
        .filter((i) => onAir.some((o) => o.id === i.id))
        .flatMap((instance) => [
          {
            type: 'playout.changed' as const,
            instanceId: instance.id,
            rundownId: instance.rundownId,
            playout: instance.playout,
            revision: instance.revision,
          },
          { type: 'instance.upserted' as const, instance },
        ])
      publishMany(command.rundownId, events)
      return { ok: true, events, rundownId: command.rundownId }
    }

    case 'playout.panic': {
      const rundown = store.getRundown(command.rundownId)
      if (!rundown) return err('not_found', `Rundown ${command.rundownId} not found`)
      const before = store.listInstances(command.rundownId)
      const onAir = before.filter((i) => i.playout.onScreen)
      const at = Date.now()
      store.clearAllOnScreen(command.rundownId)
      const after = store.listInstances(command.rundownId)
      const events: ControlEvent[] = [
        { type: 'playout.panic', rundownId: command.rundownId, at },
        ...after
          .filter((i) => onAir.some((o) => o.id === i.id))
          .flatMap((instance) => [
            {
              type: 'playout.changed' as const,
              instanceId: instance.id,
              rundownId: instance.rundownId,
              playout: instance.playout,
              revision: instance.revision,
            },
            { type: 'instance.upserted' as const, instance },
          ]),
      ]
      publishMany(command.rundownId, events)
      return { ok: true, events, rundownId: command.rundownId }
    }

    case 'rundown.attachPackage': {
      const rundown = store.getRundown(command.rundownId)
      if (!rundown) return err('not_found', `Rundown ${command.rundownId} not found`)
      const pkg = getLoadedPackage(command.packageId)
      if (!pkg || pkg.error) return err('unknown_package', `Package ${command.packageId} not found`)

      let config =
        command.config ??
        store.getPackageAttachment(command.rundownId, command.packageId)?.config ??
        (pkg.config?.defaults as Record<string, unknown> | undefined) ??
        {}
      if (pkg.config?.schema) {
        const parsed = pkg.config.schema.safeParse(config)
        if (!parsed.success) {
          return err(
            'invalid_config',
            parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
          )
        }
        config = parsed.data
      }

      const attachment = store.attachPackage(command.rundownId, command.packageId, config)
      const events: ControlEvent[] = [
        {
          type: 'rundown.package',
          rundownId: command.rundownId,
          packageId: command.packageId,
          attached: true,
          config: attachment.config,
        },
      ]
      publishMany(command.rundownId, events)
      startAutostartProviders(command.rundownId, command.packageId)
      recomputeRundownProjection(command.rundownId)
      return { ok: true, events, rundownId: command.rundownId }
    }

    case 'rundown.detachPackage': {
      const rundown = store.getRundown(command.rundownId)
      if (!rundown) return err('not_found', `Rundown ${command.rundownId} not found`)
      const attachment = store.detachPackage(command.rundownId, command.packageId)
      if (!attachment) return err('not_attached', `Package ${command.packageId} is not attached`)
      stopAllProvidersForPackage(command.rundownId, command.packageId)
      const events: ControlEvent[] = [
        {
          type: 'rundown.package',
          rundownId: command.rundownId,
          packageId: command.packageId,
          attached: false,
          config: attachment.config,
        },
      ]
      publishMany(command.rundownId, events)
      return { ok: true, events, rundownId: command.rundownId }
    }

    case 'rundown.patchConfig': {
      const attachment = store.getPackageAttachment(command.rundownId, command.packageId)
      if (!attachment) return err('not_attached', `Package ${command.packageId} is not attached`)
      const pkg = getLoadedPackage(command.packageId)
      if (pkg?.config?.schema) {
        const merged = deepMerge(attachment.config, command.patch)
        const parsed = pkg.config.schema.safeParse(merged)
        if (!parsed.success) {
          return err(
            'invalid_config',
            parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
          )
        }
      }
      const updated = store.patchPackageConfig(command.rundownId, command.packageId, command.patch)!
      const events: ControlEvent[] = [
        {
          type: 'rundown.package',
          rundownId: command.rundownId,
          packageId: command.packageId,
          attached: updated.attached,
          config: updated.config,
        },
      ]
      publishMany(command.rundownId, events)
      restartProvidersIfNeeded(command.rundownId, command.packageId)
      recomputeRundownProjection(command.rundownId)
      return { ok: true, events, rundownId: command.rundownId }
    }

    case 'rundown.replaceConfig': {
      const attachment = store.getPackageAttachment(command.rundownId, command.packageId)
      if (!attachment) return err('not_attached', `Package ${command.packageId} is not attached`)
      const pkg = getLoadedPackage(command.packageId)
      let config = command.config
      if (pkg?.config?.schema) {
        const parsed = pkg.config.schema.safeParse(config)
        if (!parsed.success) {
          return err(
            'invalid_config',
            parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
          )
        }
        config = parsed.data
      }
      const updated = store.replacePackageConfig(command.rundownId, command.packageId, config)!
      const events: ControlEvent[] = [
        {
          type: 'rundown.package',
          rundownId: command.rundownId,
          packageId: command.packageId,
          attached: updated.attached,
          config: updated.config,
        },
      ]
      publishMany(command.rundownId, events)
      restartProvidersIfNeeded(command.rundownId, command.packageId)
      recomputeRundownProjection(command.rundownId)
      return { ok: true, events, rundownId: command.rundownId }
    }

    case 'data.publish': {
      const attachment = store.getPackageAttachment(command.rundownId, command.packageId)
      if (!attachment?.attached) {
        return err('not_attached', `Package ${command.packageId} is not attached to this rundown`)
      }
      const pkg = getLoadedPackage(command.packageId)
      let value = command.value
      const schema = pkg?.dataSchemas?.[command.key]
      if (schema) {
        const parsed = schema.safeParse(value)
        if (!parsed.success) {
          return err(
            'invalid_data',
            parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
          )
        }
        value = parsed.data
      }
      const record = store.publishRundownData(command.rundownId, command.packageId, command.key, value)
      const events: ControlEvent[] = [
        {
          type: 'data.changed',
          rundownId: command.rundownId,
          packageId: command.packageId,
          key: command.key,
          value: record.value,
          revision: record.revision,
          updatedAt: record.updatedAt,
        },
      ]
      publishMany(command.rundownId, events)
      recomputeRundownProjection(command.rundownId)
      return { ok: true, events, rundownId: command.rundownId }
    }

    case 'data.clear': {
      const attachment = store.getPackageAttachment(command.rundownId, command.packageId)
      if (!attachment?.attached) {
        return err('not_attached', `Package ${command.packageId} is not attached to this rundown`)
      }
      store.clearRundownData(command.rundownId, command.packageId, command.key)
      const events: ControlEvent[] = [
        {
          type: 'data.changed',
          rundownId: command.rundownId,
          packageId: command.packageId,
          key: command.key,
          value: undefined,
          revision: 0,
          updatedAt: Date.now(),
        },
      ]
      publishMany(command.rundownId, events)
      recomputeRundownProjection(command.rundownId)
      return { ok: true, events, rundownId: command.rundownId }
    }

    default: {
      const _exhaustive: never = command
      return err('unknown_command', `Unhandled command ${(_exhaustive as ControlCommand).type}`)
    }
  }
}
