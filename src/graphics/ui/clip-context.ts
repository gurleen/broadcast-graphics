import { createContext } from 'react'
import type * as THREE from 'three'

/**
 * World-space clipping planes accumulated from ancestor `<Clip>` regions.
 * Paint components (`Box`, `Image`, `Text`) read this and assign it to
 * their material's `clippingPlanes`.
 */
export const ClipContext = createContext<THREE.Plane[]>([])
