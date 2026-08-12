/**
 * Remote reference-data cache for packages (`datasets` in definePackage).
 * Remote is the source of truth; a disk cache under `data/cache/<pkg>/<id>.json`
 * keeps datasets available offline / on fetch failure.
 */
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { getLoadedPackage } from './packages'

type CacheEntry = { data: unknown; fetchedAt: number }

type GlobalDatasets = typeof globalThis & { __controllerDatasets?: Map<string, CacheEntry> }

function memCache(): Map<string, CacheEntry> {
  const g = globalThis as GlobalDatasets
  if (!g.__controllerDatasets) g.__controllerDatasets = new Map()
  return g.__controllerDatasets
}

function cacheKey(packageId: string, datasetId: string): string {
  return `${packageId}/${datasetId}`
}

function cacheDir(): string {
  return process.env.HYDRA_DATASET_CACHE_DIR ?? path.join('data', 'cache')
}

function cacheFile(packageId: string, datasetId: string): string {
  return path.join(cacheDir(), packageId, `${datasetId}.json`)
}

/** Synchronous read of whatever is already cached in memory (for provider `ctx.dataset`). */
export function getDatasetSync(packageId: string, datasetId: string): unknown {
  return memCache().get(cacheKey(packageId, datasetId))?.data
}

/**
 * Ensure a dataset is loaded: serve fresh memory cache, else fetch (revalidating
 * on TTL), else fall back to the on-disk cache, else return whatever is cached.
 */
export async function ensureDataset(packageId: string, datasetId: string): Promise<unknown> {
  const pkg = getLoadedPackage(packageId)
  const decl = pkg?.datasets?.find((d) => d.id === datasetId)
  if (!decl) return undefined

  const key = cacheKey(packageId, datasetId)
  const ttlMs = decl.ttlMs ?? 60 * 60 * 1000
  const cached = memCache().get(key)
  if (cached && Date.now() - cached.fetchedAt < ttlMs) return cached.data

  try {
    const res = await fetch(decl.url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    memCache().set(key, { data, fetchedAt: Date.now() })
    void persistToDisk(packageId, datasetId, data)
    return data
  } catch (err) {
    console.error(`[datasets] fetch failed for ${key}:`, err instanceof Error ? err.message : err)
    if (cached) return cached.data
    const fromDisk = await readFromDisk(packageId, datasetId)
    if (fromDisk !== undefined) {
      memCache().set(key, { data: fromDisk, fetchedAt: Date.now() })
      return fromDisk
    }
    return undefined
  }
}

async function persistToDisk(packageId: string, datasetId: string, data: unknown): Promise<void> {
  try {
    const file = cacheFile(packageId, datasetId)
    await mkdir(path.dirname(file), { recursive: true })
    await Bun.write(file, JSON.stringify(data))
  } catch (err) {
    console.error(`[datasets] failed to persist ${packageId}/${datasetId}:`, err)
  }
}

async function readFromDisk(packageId: string, datasetId: string): Promise<unknown> {
  try {
    const file = Bun.file(cacheFile(packageId, datasetId))
    if (!(await file.exists())) return undefined
    return await file.json()
  } catch {
    return undefined
  }
}

/** Test helper. */
export function resetDatasetCache(): void {
  const g = globalThis as GlobalDatasets
  g.__controllerDatasets = undefined
}
