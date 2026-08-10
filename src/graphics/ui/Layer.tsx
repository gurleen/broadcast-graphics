import { Suspense, use, useEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FlexDirection } from 'yoga-layout/load'
import { GRAPHIC_HEIGHT, GRAPHIC_WIDTH } from '../constants'
import { LayoutContext } from './context'
import type { LayoutContextValue } from './context'
import { runLayoutPass } from './engine'
import { getYoga, getYogaConfig } from './yoga'

export type LayerProps = {
  children?: ReactNode
  /** Frame width in pixels. Defaults to the graphic's full width. */
  width?: number
  /** Frame height in pixels. Defaults to the graphic's full height. */
  height?: number
}

/**
 * Root of a yoga-flexbox layout tree. Establishes a top-left-origin,
 * y-down, pixel-unit coordinate frame for its children (`Box`, `Flex`,
 * `Text`, `Image`, `Clip`, ...) sized to `width` x `height`.
 */
export function Layer({ children = null, width = GRAPHIC_WIDTH, height = GRAPHIC_HEIGHT }: LayerProps) {
  return (
    <Suspense fallback={null}>
      <LayerContent width={width} height={height}>
        {children}
      </LayerContent>
    </Suspense>
  )
}

function LayerContent({ children, width, height }: Required<LayerProps>) {
  const yoga = use(getYoga())
  const config = useMemo(() => getYogaConfig(yoga), [yoga])

  const rootNode = useMemo(() => {
    const node = yoga.Node.create(config)
    node.setFlexDirection(FlexDirection.Column)
    node.setWidth(width)
    node.setHeight(height)
    return node
  }, [yoga, config, width, height])

  const groupRef = useRef<THREE.Group>(null)
  const dirtyRef = useRef(true)

  useEffect(() => {
    dirtyRef.current = true
  }, [rootNode])

  useFrame(() => {
    if (!dirtyRef.current) return
    const group = groupRef.current
    if (!group) return
    dirtyRef.current = false
    runLayoutPass(group, rootNode, width, height)
  }, -1000)

  const requestLayout = useMemo(
    () => () => {
      dirtyRef.current = true
    },
    [],
  )

  const contextValue = useMemo<LayoutContextValue>(
    () => ({ yoga, config, requestLayout }),
    [yoga, config, requestLayout],
  )

  return (
    <group ref={groupRef} position={[-width / 2, height / 2, 0]}>
      <LayoutContext.Provider value={contextValue}>{children}</LayoutContext.Provider>
    </group>
  )
}
