import * as store from './store'
import { listRenderers } from './sessions'
import { getHubSeq } from './hub'
import { listProviderStatuses } from './providers'
import type { RundownSnapshot } from '../model'

export function buildSnapshot(rundownId: string): RundownSnapshot | null {
  const rundown = store.getRundown(rundownId)
  if (!rundown) return null
  return {
    rundown,
    instances: store.listInstances(rundownId),
    renderers: listRenderers(rundownId),
    packages: store.listPackageAttachments(rundownId, true),
    data: store.listRundownData(rundownId),
    providers: listProviderStatuses(rundownId),
    seq: getHubSeq(rundownId),
    serverTime: Date.now(),
  }
}
