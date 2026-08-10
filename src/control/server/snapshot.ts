import * as store from './store'
import { listRenderers } from './sessions'
import { getHubSeq } from './hub'
import type { RundownSnapshot } from '../model'

export function buildSnapshot(rundownId: string): RundownSnapshot | null {
  const rundown = store.getRundown(rundownId)
  if (!rundown) return null
  return {
    rundown,
    instances: store.listInstances(rundownId),
    renderers: listRenderers(rundownId),
    seq: getHubSeq(rundownId),
    serverTime: Date.now(),
  }
}
