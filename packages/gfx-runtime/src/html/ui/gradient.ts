export type GradientStop = {
  /** Position along the gradient, 0-1. */
  offset: number
  color: string
}

export type GradientProps = {
  /** Angle in degrees, measured counter-clockwise from the positive x-axis. Default `0` (left-to-right). */
  angle?: number
  stops: GradientStop[]
}

/** Builds a CSS `linear-gradient()` matching the R3F gradient angle convention. */
export function toCssGradient({ angle = 0, stops }: GradientProps): string {
  const sorted = [...stops].sort((a, b) => a.offset - b.offset)
  const cssAngle = 90 - angle
  const stopList = sorted.map((s) => `${s.color} ${s.offset * 100}%`).join(', ')
  return `linear-gradient(${cssAngle}deg, ${stopList})`
}

function parseHexColor(hex: string): [r: number, g: number, b: number] {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) {
    throw new Error(`darkenColor: expected #rgb or #rrggbb, got ${JSON.stringify(hex)}`)
  }
  let digits = match[1]
  if (digits.length === 3) {
    digits = digits
      .split('')
      .map((c) => c + c)
      .join('')
  }
  return [
    Number.parseInt(digits.slice(0, 2), 16),
    Number.parseInt(digits.slice(2, 4), 16),
    Number.parseInt(digits.slice(4, 6), 16),
  ]
}

function channelToHex(n: number): string {
  return Math.round(Math.min(255, Math.max(0, n)))
    .toString(16)
    .padStart(2, '0')
}

/** Blends `color` toward black. `amount` is 0 (unchanged) through 1 (black). */
export function darkenColor(color: string, amount: number): string {
  const t = Math.min(1, Math.max(0, amount))
  const [r, g, b] = parseHexColor(color)
  const scale = 1 - t
  return `#${channelToHex(r * scale)}${channelToHex(g * scale)}${channelToHex(b * scale)}`
}

