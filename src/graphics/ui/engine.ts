import { Direction } from 'yoga-layout/load'
import type * as THREE from 'three'
import type { Node as YogaNode } from 'yoga-layout/load'
import { getLayoutEntry } from './entry'

/**
 * Depth-first collects the yoga nodes that should become direct children of
 * `object`'s own layout node. Plain wrapper `<group>`s (anything without a
 * layout entry) are transparent and get flattened through.
 */
function collectYogaChildren(object: THREE.Object3D, out: YogaNode[]) {
  for (const child of object.children) {
    const entry = getLayoutEntry(child)
    if (entry) {
      out.push(entry.node)
    } else {
      collectYogaChildren(child, out)
    }
  }
}

/** Re-links `node`'s yoga children to match `desired`, only touching yoga if the order actually changed. */
function syncChildren(node: YogaNode, desired: YogaNode[]) {
  const count = node.getChildCount()
  let same = count === desired.length
  if (same) {
    for (let i = 0; i < count; i++) {
      if (node.getChild(i) !== desired[i]) {
        same = false
        break
      }
    }
  }
  if (same) return

  for (let i = count - 1; i >= 0; i--) {
    node.removeChild(node.getChild(i))
  }
  desired.forEach((child, i) => node.insertChild(child, i))
}

function reconcile(object: THREE.Object3D) {
  const entry = getLayoutEntry(object)
  if (entry) {
    const desired: YogaNode[] = []
    collectYogaChildren(object, desired)
    syncChildren(entry.node, desired)
  }
  for (const child of object.children) {
    reconcile(child)
  }
}

type OrderCounter = { current: number }

function apply(object: THREE.Object3D, order: OrderCounter) {
  const entry = getLayoutEntry(object)
  if (entry) {
    const layout = entry.node.getComputedLayout()
    // Intermediate plain <group> wrappers must stay at identity position/scale
    // for this parent-relative placement to line up with yoga's own math.
    object.position.set(layout.left, -layout.top, object.position.z)
    object.renderOrder = entry.zIndex ?? order.current++
    object.updateMatrixWorld()
    entry.onApply?.({ width: layout.width, height: layout.height }, object)
  }
  for (const child of object.children) {
    apply(child, order)
  }
}

/** Runs one full reconcile -> calculateLayout -> apply pass rooted at `root`/`rootNode`. */
export function runLayoutPass(root: THREE.Object3D, rootNode: YogaNode, width: number, height: number) {
  const desired: YogaNode[] = []
  collectYogaChildren(root, desired)
  syncChildren(rootNode, desired)
  for (const child of root.children) {
    reconcile(child)
  }

  rootNode.calculateLayout(width, height, Direction.LTR)

  root.updateMatrixWorld()
  const order: OrderCounter = { current: 1 }
  for (const child of root.children) {
    apply(child, order)
  }
}
