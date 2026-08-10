import { useCallback, useContext, useEffect, useLayoutEffect, useRef } from 'react'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { ClipContext } from './clip-context'
import type { LayoutRect } from './entry'
import { useLayoutNode } from './LayoutNode'
import type { CornerRadius } from './radius'
import { resolveRadius } from './radius'
import { RectMaterialImpl, unitPlaneGeometry } from './RectMaterial'
import type { RectMaterial } from './RectMaterial'
import type { StyleProps } from './style'

export type ObjectFit = 'contain' | 'cover' | 'fill'

export type ImageProps = StyleProps & {
  src: string
  /** How the image is fit into its computed box. Defaults to `'cover'`. */
  fit?: ObjectFit
  radius?: CornerRadius
  opacity?: number
}

/** Fraction of the box (contain) or texture (cover) that stays un-cropped/visible along each axis. */
function fitScale(fit: ObjectFit, boxAspect: number, imgAspect: number): [number, number] {
  if (fit === 'fill' || !Number.isFinite(boxAspect) || !Number.isFinite(imgAspect) || boxAspect <= 0 || imgAspect <= 0) {
    return [1, 1]
  }
  if (fit === 'cover') {
    return imgAspect > boxAspect ? [boxAspect / imgAspect, 1] : [1, imgAspect / boxAspect]
  }
  // contain
  return imgAspect > boxAspect ? [1, boxAspect / imgAspect] : [imgAspect / boxAspect, 1]
}

/** Multiplier for `(vUv - 0.5) * k + 0.5` texture sampling: shrinks the sample window for 'cover', expands it (triggering letterbox discard) for 'contain'. */
function computeUvScale(fit: ObjectFit, boxAspect: number, imgAspect: number): [number, number] {
  const [sx, sy] = fitScale(fit, boxAspect, imgAspect)
  if (fit === 'contain') return [1 / sx, 1 / sy]
  return [sx, sy]
}

/**
 * A textured rounded rect. Behaves like `Rect` but samples `src` instead of
 * (or blended with, via the shared material) a solid fill/gradient.
 */
export function Image({ src, fit = 'cover', radius, opacity = 1, ...style }: ImageProps) {
  const texture = useTexture(src)
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<RectMaterial>(null)
  const clipPlanes = useContext(ClipContext)
  const [tl, tr, br, bl] = resolveRadius(radius)

  const handleApply = useCallback(
    (rect: LayoutRect) => {
      const mesh = meshRef.current
      if (!mesh) return
      const w = Math.max(rect.width, 0)
      const h = Math.max(rect.height, 0)
      mesh.visible = w > 0 && h > 0
      mesh.position.set(w / 2, -h / 2, 0)
      mesh.scale.set(Math.max(w, 0.0001), Math.max(h, 0.0001), 1)

      const material = materialRef.current
      if (!material) return
      material.uniforms.uSize.value.set(w, h)

      const image = texture.image as { width?: number; height?: number } | undefined
      const naturalWidth = image?.width ?? w
      const naturalHeight = image?.height ?? h
      const boxAspect = h > 0 ? w / h : 1
      const imgAspect = naturalHeight > 0 ? naturalWidth / naturalHeight : 1
      const [scaleX, scaleY] = computeUvScale(fit, boxAspect, imgAspect)
      material.uniforms.uUvRect.value.set(0, 0, scaleX, scaleY)
    },
    [texture, fit],
  )

  const { ref: groupRef } = useLayoutNode(style, handleApply)

  useLayoutEffect(() => {
    const material = materialRef.current
    if (!material) return
    material.uniforms.uOpacity.value = opacity
    material.uniforms.uRadius.value.set(tl, tr, br, bl)
    material.uniforms.uHasTexture.value = true
    material.uniforms.uTexture.value = texture
    material.clippingPlanes = clipPlanes.length > 0 ? clipPlanes : null
  })

  useEffect(() => {
    texture.needsUpdate = true
  }, [texture])

  return (
    <group ref={groupRef}>
      <mesh ref={meshRef} geometry={unitPlaneGeometry}>
        <rectMaterial ref={materialRef} key={RectMaterialImpl.key} />
      </mesh>
    </group>
  )
}
