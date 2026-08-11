import { useWebFont } from './font'
import { cssFilter } from './shadow'
import type { DropShadow } from './shadow'
import { toFlexItemStyle } from './style'
import type { StyleProps } from './style'

export type TextAlign = 'left' | 'right' | 'center' | 'justify'

export type TextProps = Omit<StyleProps, 'width' | 'height'> & {
  children: string | number
  color?: string
  /** Pixels, matching the frame's pixel-unit coordinate space. */
  fontSize?: number
  fontFamily?: string
  letterSpacing?: number
  lineHeight?: number
  /**
   * Text alignment within its wrapped block. Named `textAlign` (rather than
   * `align`) to avoid colliding with `StyleProps.align` (cross-axis flex alignment).
   */
  textAlign?: TextAlign
  opacity?: number
  /** Set `true` to keep text on one line (e.g. inside a fixed-width ancestor with `overflow: hidden` for truncation). */
  singleLine?: boolean
  /** CSS `filter`, e.g. `drop-shadow(...)`. Use a string or {@link DropShadow}. */
  shadow?: string | DropShadow
  className?: string
}

export function Text({
  children,
  color = '#ffffff',
  fontSize = 32,
  fontFamily,
  letterSpacing,
  lineHeight = 0,
  textAlign = 'left',
  opacity = 1,
  singleLine = false,
  shadow,
  className,
  ...style
}: TextProps) {

  return (
    <div
      className={className}
      style={{
        ...toFlexItemStyle(style),
        color,
        fontSize,
        fontFamily: fontFamily ?? useWebFont(fontFamily),
        letterSpacing: letterSpacing != null ? `${letterSpacing}em` : undefined,
        lineHeight,
        textAlign,
        opacity,
        whiteSpace: singleLine ? 'nowrap' : 'normal',
        filter: cssFilter(shadow),
      }}
    >
      {String(children)}
    </div>
  )
}
