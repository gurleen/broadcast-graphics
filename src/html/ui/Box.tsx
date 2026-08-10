import type { ReactNode } from 'react'
import { toCssGradient } from './gradient'
import type { GradientProps } from './gradient'
import { cssBorderRadius } from './radius'
import type { CornerRadius } from './radius'
import { cssFilter } from './shadow'
import type { DropShadow } from './shadow'
import { toFlexStyle } from './style'
import type { StyleProps } from './style'

export type BoxProps = StyleProps & {
  children?: ReactNode
  /** Solid fill. Ignored (as a color) when `gradient` is also set. */
  background?: string
  gradient?: GradientProps
  radius?: CornerRadius
  opacity?: number
  border?: number
  borderColor?: string
  /** CSS `filter`, e.g. `drop-shadow(...)`. Use a string or {@link DropShadow}. */
  shadow?: string | DropShadow
  className?: string
}

/**
 * A generic flex container with an optional painted background.
 * Use `Rect` for a leaf that always paints, or `Row`/`Column`/`Flex` for direction presets.
 */
export function Box({
  children,
  background,
  gradient,
  radius,
  opacity = 1,
  border = 0,
  borderColor = '#000000',
  shadow,
  className,
  ...style
}: BoxProps) {
  const paints = background != null || gradient != null
  const fillBackground =
    gradient != null ? toCssGradient(gradient) : background != null ? background : undefined

  return (
    <div
      className={className}
      style={{
        ...toFlexStyle(style),
        ...(paints && fillBackground != null ? { background: fillBackground } : {}),
        borderRadius: cssBorderRadius(radius),
        opacity,
        border: border > 0 ? `${border}px solid ${borderColor}` : undefined,
        filter: cssFilter(shadow),
      }}
    >
      {children}
    </div>
  )
}
