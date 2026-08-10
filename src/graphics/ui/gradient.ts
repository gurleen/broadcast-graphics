import * as THREE from 'three'

export type GradientStop = {
  /** Position along the gradient, 0-1. */
  offset: number
  color: THREE.ColorRepresentation
}

export type GradientProps = {
  /** Angle in degrees, measured counter-clockwise from the positive x-axis. Default `0` (left-to-right). */
  angle?: number
  stops: GradientStop[]
}

const GRADIENT_TEXTURE_SIZE = 256
const tmpColorA = new THREE.Color()
const tmpColorB = new THREE.Color()

function sampleGradient(stops: readonly GradientStop[], t: number, out: THREE.Color) {
  if (stops.length === 0) {
    out.set('#000000')
    return
  }
  if (stops.length === 1 || t <= stops[0].offset) {
    out.set(stops[0].color)
    return
  }
  const last = stops[stops.length - 1]
  if (t >= last.offset) {
    out.set(last.color)
    return
  }
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]
    const b = stops[i + 1]
    if (t >= a.offset && t <= b.offset) {
      const span = b.offset - a.offset || 1
      const localT = (t - a.offset) / span
      tmpColorA.set(a.color)
      tmpColorB.set(b.color)
      out.copy(tmpColorA).lerp(tmpColorB, localT)
      return
    }
  }
  out.set(last.color)
}

/** Bakes an arbitrary number of gradient stops into a 256x1 lookup texture sampled by the rect shader. */
export function createGradientTexture(stops: readonly GradientStop[]): THREE.DataTexture {
  const sorted = [...stops].sort((a, b) => a.offset - b.offset)
  const data = new Uint8Array(GRADIENT_TEXTURE_SIZE * 4)
  const color = new THREE.Color()
  for (let i = 0; i < GRADIENT_TEXTURE_SIZE; i++) {
    const t = i / (GRADIENT_TEXTURE_SIZE - 1)
    sampleGradient(sorted, t, color)
    data[i * 4 + 0] = Math.round(color.r * 255)
    data[i * 4 + 1] = Math.round(color.g * 255)
    data[i * 4 + 2] = Math.round(color.b * 255)
    data[i * 4 + 3] = 255
  }
  const texture = new THREE.DataTexture(data, GRADIENT_TEXTURE_SIZE, 1, THREE.RGBAFormat)
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.wrapS = THREE.ClampToEdgeWrapping
  // Bytes above are already linear (THREE.Color's internal representation with
  // color management on), so leave colorSpace at its NoColorSpace default to
  // avoid a second sRGB decode when the shader samples this texture.
  texture.needsUpdate = true
  return texture
}
