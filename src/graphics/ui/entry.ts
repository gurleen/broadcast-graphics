import type * as THREE from 'three'
import type { Node as YogaNode } from 'yoga-layout/load'

/** The computed content box of a layout node, in pixels. */
export type LayoutRect = {
  width: number
  height: number
}

/**
 * Bookkeeping stashed on a layout-participating `Object3D`'s `userData`.
 * The imperative engine (`engine.ts`) reads/writes this every layout pass.
 */
export type LayoutEntry = {
  node: YogaNode
  /** Called with the node's computed content box after every layout pass. */
  onApply?: (rect: LayoutRect, object: THREE.Object3D) => void
  /** Explicit paint-order override; falls back to document order when unset. */
  zIndex?: number
}

const USER_DATA_KEY = '__graphicsLayout'

export function setLayoutEntry(object: THREE.Object3D, entry: LayoutEntry) {
  object.userData[USER_DATA_KEY] = entry
}

export function getLayoutEntry(object: THREE.Object3D): LayoutEntry | undefined {
  return object.userData[USER_DATA_KEY] as LayoutEntry | undefined
}

export function clearLayoutEntry(object: THREE.Object3D) {
  delete object.userData[USER_DATA_KEY]
}
