import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import * as THREE from 'three'
import { ClipContext } from './clip-context'
import type { LayoutRect } from './entry'
import { createGradientTexture } from './gradient'
import type { GradientProps } from './gradient'
import { useLayoutNode } from './LayoutNode'
import { RectMaterialImpl, unitPlaneGeometry } from './RectMaterial'
import type { RectMaterial } from './RectMaterial'
import type { CornerRadius } from './radius'
import { resolveRadius } from './radius'
import type { StyleProps } from './style'

export type BoxProps = StyleProps & {
  children?: ReactNode
  /** Solid fill. Ignored (as a color) when `gradient` is also set. */
  background?: THREE.ColorRepresentation
  gradient?: GradientProps
  radius?: CornerRadius
  opacity?: number
  border?: number
  borderColor?: THREE.ColorRepresentation
}

/**
 * A generic flex container: a yoga layout node with an optional painted
 * rounded-rect background. Use `Rect` for a leaf that always paints, or
 * `Row`/`Column`/`Flex` for direction presets.
 */
export function Box({
  children,
  background,
  gradient,
  radius,
  opacity = 1,
  border = 0,
  borderColor = '#000000',
  ...style
}: BoxProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<RectMaterial>(null)
  const paints = background != null || gradient != null
  const clipPlanes = useContext(ClipContext)

  const gradientKey = gradient ? JSON.stringify(gradient.stops) : null
  const gradientTexture = useMemo(
    () => (gradient ? createGradientTexture(gradient.stops) : null),
    // gradientKey mirrors gradient.stops; gradient.angle doesn't affect the baked texture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gradientKey],
  )
  useEffect(() => () => gradientTexture?.dispose(), [gradientTexture])

  const [tl, tr, br, bl] = resolveRadius(radius)

  const handleApply = useCallback((rect: LayoutRect) => {
    const mesh = meshRef.current
    if (!mesh) return
    const w = Math.max(rect.width, 0)
    const h = Math.max(rect.height, 0)
    mesh.visible = w > 0 && h > 0
    mesh.position.set(w / 2, -h / 2, 0)
    mesh.scale.set(Math.max(w, 0.0001), Math.max(h, 0.0001), 1)
    materialRef.current?.uniforms.uSize.value.set(w, h)
  }, [])

  const { ref: groupRef } = useLayoutNode(style, paints ? handleApply : undefined)

  useLayoutEffect(() => {
    const material = materialRef.current
    if (!material) return
    material.uniforms.uColor.value.set(background ?? '#000000')
    material.uniforms.uOpacity.value = opacity
    material.uniforms.uRadius.value.set(tl, tr, br, bl)
    material.uniforms.uBorderWidth.value = border
    material.uniforms.uBorderColor.value.set(borderColor)
    material.uniforms.uHasGradient.value = gradient != null
    material.uniforms.uGradientTex.value = gradientTexture
    material.uniforms.uGradientAngle.value = ((gradient?.angle ?? 0) * Math.PI) / 180
    material.clippingPlanes = clipPlanes.length > 0 ? clipPlanes : null
  })

  return (
    <group ref={groupRef}>
      {paints && (
        <mesh ref={meshRef} geometry={unitPlaneGeometry}>
          <rectMaterial ref={materialRef} key={RectMaterialImpl.key} />
        </mesh>
      )}
      {children}
    </group>
  )
}
