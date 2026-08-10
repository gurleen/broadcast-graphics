import { useCallback, useContext, useEffect, useLayoutEffect, useRef } from 'react'
import { Text as DreiText } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { MeasureFunction } from 'yoga-layout/load'
import { ClipContext } from './clip-context'
import type { LayoutRect } from './entry'
import { useLayoutNode } from './LayoutNode'
import type { StyleProps } from './style'

export type TextAlign = 'left' | 'right' | 'center' | 'justify'

export type TextProps = Omit<StyleProps, 'width' | 'height'> & {
  children: string | number
  color?: THREE.ColorRepresentation
  /** Pixels, matching the frame's pixel-unit coordinate space. */
  fontSize?: number
  font?: string
  letterSpacing?: number
  lineHeight?: number
  /**
   * Text alignment within its wrapped block. Named `textAlign` (rather than
   * `align`) to avoid colliding with `StyleProps.align` (cross-axis flex alignment).
   */
  textAlign?: TextAlign
  opacity?: number
  /** Set `true` to keep text on one line (e.g. inside a fixed-width `Clip` for truncation). Defaults to `false`. */
  singleLine?: boolean
}

type TroikaTextMesh = THREE.Mesh & {
  maxWidth?: number
  sync: (callback?: () => void) => void
  textRenderInfo?: { blockBounds: [number, number, number, number] }
}

const FALLBACK_LINE_HEIGHT = 1.15

/**
 * Top-left-anchored text that measures itself for yoga: an intrinsic size is
 * reported synchronously from a cache, then corrected (and yoga re-triggered)
 * once troika finishes an async glyph layout via `onSync`. Wrapping is driven
 * by feeding the node's computed width back in as troika's `maxWidth`, so
 * expect a one-frame settle when a `Text` is first constrained by its parent.
 */
export function Text({
  children,
  color = '#ffffff',
  fontSize = 32,
  font,
  letterSpacing,
  lineHeight,
  textAlign = 'left',
  opacity = 1,
  singleLine = false,
  ...style
}: TextProps) {
  const meshRef = useRef<TroikaTextMesh | null>(null)
  const invalidate = useThree((state) => state.invalidate)
  const clipPlanes = useContext(ClipContext)
  const clipPlanesRef = useRef(clipPlanes)
  clipPlanesRef.current = clipPlanes

  const measuredRef = useRef({ width: 0, height: fontSize * (lineHeight ?? FALLBACK_LINE_HEIGHT) })

  const measureFunc = useCallback<MeasureFunction>((_width, _widthMode, _height, _heightMode) => {
    return { width: measuredRef.current.width, height: measuredRef.current.height }
  }, [])

  const handleApply = useCallback(
    (rect: LayoutRect) => {
      const mesh = meshRef.current
      if (!mesh) return
      const nextMaxWidth = rect.width > 0 ? rect.width : undefined
      if (mesh.maxWidth !== nextMaxWidth) {
        mesh.maxWidth = nextMaxWidth
        mesh.sync(() => invalidate())
      }
    },
    [invalidate],
  )

  const { ref: groupRef, node, requestLayout } = useLayoutNode(style, handleApply)

  useLayoutEffect(() => {
    node.setMeasureFunc(measureFunc)
    return () => node.unsetMeasureFunc()
  }, [node, measureFunc])

  const applyClipping = useCallback(() => {
    const material = meshRef.current?.material as THREE.Material | undefined
    if (!material) return
    material.clippingPlanes = clipPlanesRef.current.length > 0 ? clipPlanesRef.current : null
  }, [])

  useEffect(applyClipping, [applyClipping, clipPlanes])

  const handleSync = useCallback(
    (troika: TroikaTextMesh) => {
      const bounds = troika.textRenderInfo?.blockBounds
      applyClipping()
      if (!bounds) return
      const [minX, minY, maxX, maxY] = bounds
      const width = Math.max(maxX - minX, 0)
      const height = Math.max(maxY - minY, 0)
      const measured = measuredRef.current
      if (Math.abs(width - measured.width) > 0.01 || Math.abs(height - measured.height) > 0.01) {
        measuredRef.current = { width, height }
        node.markDirty()
        requestLayout()
      }
    },
    [applyClipping, node, requestLayout],
  )

  return (
    <group ref={groupRef}>
      <DreiText
        ref={meshRef}
        color={color}
        fontSize={fontSize}
        font={font}
        letterSpacing={letterSpacing}
        lineHeight={lineHeight}
        textAlign={textAlign}
        fillOpacity={opacity}
        whiteSpace={singleLine ? 'nowrap' : 'normal'}
        anchorX="left"
        anchorY="top"
        onSync={handleSync}
      >
        {String(children)}
      </DreiText>
    </group>
  )
}
