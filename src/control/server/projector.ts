/**
 * Projects rundown live-data (+ package config) onto bound instance props.
 * Never touches SQLite — writes land in the in-memory live overlay in
 * `store.ts`, so a 1Hz clock costs zero disk writes. Recomputed synchronously
 * whenever data, config, or the instance set changes.
 */
import { getTemplateSchema } from '#/templates/schemas'
import type { TemplateSchema } from '#/templates/types'
import type { ControlEvent } from '../protocol'
import * as store from './store'
import { publishMany } from './hub'
import { deepMerge, getPath, setPath } from './util'

type LiveTemplate = TemplateSchema<Record<string, unknown>> & { packageId?: string }

export function recomputeRundownProjection(rundownId: string): void {
  const attachments = store.listPackageAttachments(rundownId, true)
  if (attachments.length === 0) return
  const configByPackage = new Map(attachments.map((a) => [a.packageId, a.config]))

  const dataByPackage = new Map<string, Record<string, unknown>>()
  for (const record of store.listRundownData(rundownId)) {
    const bucket = dataByPackage.get(record.packageId) ?? {}
    bucket[record.key] = record.value
    dataByPackage.set(record.packageId, bucket)
  }

  const instances = store.listInstances(rundownId)
  const events: ControlEvent[] = []

  for (const instance of instances) {
    const template = getTemplateSchema(instance.templateId) as LiveTemplate | undefined
    const bind = template?.live?.bind
    if (!template || !bind || !template.packageId) continue
    if (!configByPackage.has(template.packageId)) continue

    const ctx = {
      data: dataByPackage.get(template.packageId) ?? {},
      config: configByPackage.get(template.packageId) ?? {},
    }

    const patch: Record<string, unknown> = {}
    let changed = false
    for (const [propPath, sourcePath] of Object.entries(bind)) {
      const value = getPath(ctx, sourcePath)
      if (value === undefined) continue
      setPath(patch, propPath, value)
      changed = true
    }
    if (!changed) continue

    const prospective = deepMerge(instance.props, patch)
    const parsed = template.schema.safeParse(prospective)
    if (!parsed.success) {
      console.warn(
        `[projector] skipping live patch for instance ${instance.id} (${instance.templateId}): invalid props`,
      )
      continue
    }

    const updated = store.setLiveOverlayProps(instance.id, patch)
    if (!updated) continue

    events.push({
      type: 'instance.props',
      instanceId: updated.id,
      rundownId,
      patch,
      props: updated.props,
      revision: updated.revision,
    })
  }

  if (events.length) publishMany(rundownId, events)
}
