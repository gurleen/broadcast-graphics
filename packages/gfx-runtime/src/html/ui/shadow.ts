export type DropShadow = {
  color: string
  offsetX?: number
  offsetY?: number
  blur: number
}

/** Builds a single CSS `drop-shadow()` function. Color-first, matching modern syntax. */
export function toCssDropShadow({ color, offsetX = 0, offsetY = 0, blur }: DropShadow): string {
  return `drop-shadow(${color} ${offsetX}px ${offsetY}px ${blur}px)`
}

/** Resolves `shadow` for the CSS `filter` property. */
export function cssFilter(shadow: string | DropShadow | undefined): string | undefined {
  if (shadow == null) return undefined
  if (typeof shadow === 'string') return shadow
  return toCssDropShadow(shadow)
}
