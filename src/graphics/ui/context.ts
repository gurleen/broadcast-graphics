import { createContext } from 'react'
import type { Config, Yoga } from 'yoga-layout/load'

export type LayoutContextValue = {
  yoga: Yoga
  config: Config
  /** Marks the tree dirty so the nearest `<Layer>` recomputes layout before the next paint. */
  requestLayout: () => void
}

export const LayoutContext = createContext<LayoutContextValue | null>(null)
