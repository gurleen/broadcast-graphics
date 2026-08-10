/** CSS and Three.js-compatible color string (hex, rgb(), named colors, etc.). */
export type ColorHex = string

/**
 * Defines a frozen color palette for a graphic, brand kit, or show.
 *
 * @example
 * const ScorebugColors = defineColors({
 *   ...Colors,
 *   panelBone: '#F3F4F0',
 * })
 */
export function defineColors<const T extends Record<string, ColorHex>>(colors: T): Readonly<T> {
  return Object.freeze(colors)
}

/** Shared broadcast color tokens. Import and extend with `defineColors` per graphic. */
export const Colors = defineColors({
  DrexelSecondary: '#FFC600',
  DrexelPrimary: '#07294D',
  White: '#FFFFFF',
  Black: '#000000',
  Steel: '#9AA3AE',
})

export const DefaultShadow = {
  color: 'rgba(2, 8, 16, 0.5)',
  offsetY: 10,
  blur: 22,
}

export const DefaultTextShadow = {
  color: '#FFFFFF',
  offsetY: 0,
  blur: 22,
}

export type BrandColor = keyof typeof Colors
