import { loadYoga } from 'yoga-layout/load'
import type { Config, Yoga } from 'yoga-layout/load'

let yogaPromise: Promise<Yoga> | undefined
let sharedConfig: Config | undefined

/**
 * Loads the yoga-layout wasm module once and caches the promise so every
 * `<Layer>` (and React's `use()`) resolves to the same instance.
 */
export function getYoga(): Promise<Yoga> {
  if (!yogaPromise) {
    yogaPromise = loadYoga()
  }
  return yogaPromise
}

/** Shared yoga config with CSS-like defaults, created lazily once yoga is loaded. */
export function getYogaConfig(yoga: Yoga): Config {
  if (!sharedConfig) {
    sharedConfig = yoga.Config.create()
    sharedConfig.setUseWebDefaults(true)
    // 1 world unit === 1 pixel in this project's orthographic camera setup.
    sharedConfig.setPointScaleFactor(1)
  }
  return sharedConfig
}
