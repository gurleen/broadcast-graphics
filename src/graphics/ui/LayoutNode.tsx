import { useContext, useLayoutEffect, useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import type * as THREE from 'three'
import { LayoutContext } from './context'
import type { LayoutEntry } from './entry'
import { clearLayoutEntry, getLayoutEntry, setLayoutEntry } from './entry'
import { applyStyle } from './style'
import type { StyleProps } from './style'

export type LayoutNodeHandle = {
  /** Attach to the `<group>` this layout node governs. */
  ref: RefObject<THREE.Group | null>
  /** The underlying yoga node, for components (e.g. `Text`) that need custom measurement. */
  node: LayoutEntry['node']
  /** Marks the tree dirty so the nearest `<Layer>` recomputes layout before the next paint. */
  requestLayout: () => void
}

/**
 * Creates and owns a yoga node for one component instance, wiring it into
 * the imperative layout engine via the governed group's `userData`.
 *
 * Must be used inside a `<Layer>`.
 */
export function useLayoutNode(style: StyleProps, onApply?: LayoutEntry['onApply']): LayoutNodeHandle {
  const ctx = useContext(LayoutContext)
  if (!ctx) {
    throw new Error('Graphics UI components must be rendered inside a <Layer>.')
  }
  const { yoga, config, requestLayout } = ctx

  const groupRef = useRef<THREE.Group | null>(null)
  const node = useMemo(() => yoga.Node.create(config), [yoga, config])

  // Mount/unmount: register and tear down the userData entry + yoga node.
  useLayoutEffect(() => {
    const group = groupRef.current
    if (!group) return
    setLayoutEntry(group, { node })
    requestLayout()
    return () => {
      const parent = node.getParent()
      if (parent) parent.removeChild(node)
      clearLayoutEntry(group)
      requestLayout()
      // Deliberately not calling `node.free()` here: React (StrictMode, Suspense
      // retries, Fast Refresh) can re-invoke this effect's setup after cleanup
      // while reusing the same memoized `node`, and freeing a yoga node that's
      // still referenced crashes the wasm module with an out-of-bounds access.
      // The unlinked node becomes garbage-collectable JS-side; the wasm-heap
      // allocation is a small, effectively-bounded leak per real unmount, which
      // is an acceptable tradeoff for these long-lived broadcast graphics.
    }
    // `node` and `requestLayout` are stable for the lifetime of this component instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node])

  // Every commit: re-apply style + the latest onApply/zIndex closures.
  useLayoutEffect(() => {
    applyStyle(node, style)
    const group = groupRef.current
    const entry = group ? getLayoutEntry(group) : undefined
    if (entry) {
      entry.onApply = onApply
      entry.zIndex = style.zIndex
    }
    requestLayout()
  })

  return useMemo(() => ({ ref: groupRef, node, requestLayout }), [node, requestLayout])
}
