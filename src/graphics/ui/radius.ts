export type CornerRadius =
  | number
  | {
      topLeft?: number
      topRight?: number
      bottomRight?: number
      bottomLeft?: number
    }

/** Resolves a `CornerRadius` prop into `[topLeft, topRight, bottomRight, bottomLeft]`, CSS `border-radius` order. */
export function resolveRadius(radius: CornerRadius | undefined): [number, number, number, number] {
  if (radius == null) return [0, 0, 0, 0]
  if (typeof radius === 'number') return [radius, radius, radius, radius]
  return [radius.topLeft ?? 0, radius.topRight ?? 0, radius.bottomRight ?? 0, radius.bottomLeft ?? 0]
}
