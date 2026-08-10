import { useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import * as THREE from 'three'
import { ClipContext } from './clip-context'
import type { LayoutRect } from './entry'
import { useLayoutNode } from './LayoutNode'
import type { StyleProps } from './style'

export type ClipProps = StyleProps & {
  children?: ReactNode
}

function computeLocalPlanes(width: number, height: number): THREE.Plane[] {
  return [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), 0), // left edge, x >= 0
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), width), // right edge, x <= width
    new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), // top edge, y <= 0
    new THREE.Plane(new THREE.Vector3(0, 1, 0), height), // bottom edge, y >= -height
  ]
}

function planesEqual(a: THREE.Plane[], b: THREE.Plane[]) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (!a[i].normal.equals(b[i].normal) || Math.abs(a[i].constant - b[i].constant) > 0.01) return false
  }
  return true
}

/**
 * A rectangular clip region: descendants painted outside its computed box
 * are clipped via `THREE.Plane`s (requires `gl.localClippingEnabled`, set on
 * `<GraphicCanvas>`). Purely axis-aligned - ancestors must not rotate this
 * subtree for the world-space planes to stay correct. Has no visuals of its
 * own; nest a `Rect`/`Box` inside for a visible background.
 */
export function Clip({ children, ...style }: ClipProps) {
  const parentPlanes = useContext(ClipContext)
  const [worldPlanes, setWorldPlanes] = useState<THREE.Plane[]>([])

  const handleApply = useCallback((rect: LayoutRect, object: THREE.Object3D) => {
    const local = computeLocalPlanes(rect.width, rect.height)
    const world = local.map((plane) => plane.clone().applyMatrix4(object.matrixWorld))
    setWorldPlanes((prev) => (planesEqual(prev, world) ? prev : world))
  }, [])

  const { ref: groupRef } = useLayoutNode(style, handleApply)

  const merged = useMemo(() => [...parentPlanes, ...worldPlanes], [parentPlanes, worldPlanes])

  return (
    <group ref={groupRef}>
      <ClipContext.Provider value={merged}>{children}</ClipContext.Provider>
    </group>
  )
}
