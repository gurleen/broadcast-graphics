import { getTemplateSchema } from '#/templates/schemas'
import type { ControlCommand, ControlEvent } from '../protocol'
import type { ProtocolError } from '../model'
import * as store from './store'
import { publishMany } from './hub'

export type CommandResult =
  | { ok: true; events: ControlEvent[]; rundownId: string | null }
  | { ok: false; error: ProtocolError }

function err(code: string, message: string): CommandResult {
  return { ok: false, error: { code, message } }
}

function deepMerge(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      base[key] &&
      typeof base[key] === 'object' &&
      !Array.isArray(base[key])
    ) {
      out[key] = deepMerge(
        base[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      )
    } else {
      out[key] = value
    }
  }
  return out
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
      store.deleteRundown(command.rundownId)
      const events: ControlEvent[] = [
        { type: 'rundown.removed', rundownId: command.rundownId },
      ]
      publishMany(command.rundownId, events)
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
      publishMany(command.rundownId, events)
      return { ok: true, events, rundownId: command.rundownId }
    }

    case 'instance.remove': {
      const existing = store.getInstance(command.instanceId)
      if (!existing) return err('not_found', `Instance ${command.instanceId} not found`)
      store.deleteInstance(command.instanceId)
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

      const instance = store.setInstanceOnScreen(instanceId, true)!
      const rundown = store.setCuedInstance(rundownId, null)!

      const events: ControlEvent[] = [
        {
          type: 'playout.changed',
          instanceId: instance.id,
          rundownId,
          playout: instance.playout,
          revision: instance.revision,
          rundown,
        },
        { type: 'rundown.upserted', rundown },
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

    default: {
      const _exhaustive: never = command
      return err('unknown_command', `Unhandled command ${(_exhaustive as ControlCommand).type}`)
    }
  }
}
