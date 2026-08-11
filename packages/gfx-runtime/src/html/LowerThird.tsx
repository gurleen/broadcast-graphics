import type { ReactNode } from 'react'
import { GRAPHIC_HEIGHT } from '../constants'
import { Box, Column } from './ui'
import type { AlignProp, JustifyProp, LengthValue, StyleProps } from './ui'

/** Horizontal title-safe inset (10% of frame width per edge). */
export const TITLE_SAFE_INSET_X: LengthValue = '10%'

/** Vertical title-safe inset (10% of frame height per edge, px at 1080p). */
export const TITLE_SAFE_INSET_Y: LengthValue = GRAPHIC_HEIGHT * 0.1

export type LowerThirdProps = {
  children?: ReactNode
  className?: string
  /** Main-axis alignment of content within the lower-third band. Defaults to `'end'` (bottom of the band). */
  justify?: JustifyProp
  /** Cross-axis alignment within the lower-third band. */
  align?: AlignProp
} & Pick<
  StyleProps,
  | 'padding'
  | 'paddingX'
  | 'paddingY'
  | 'paddingTop'
  | 'paddingRight'
  | 'paddingBottom'
  | 'paddingLeft'
>

/**
 * Broadcast lower-third safe zone: reserves the top two-thirds of the canvas
 * and lays out `children` in the bottom third with default title-safe insets
 * (`TITLE_SAFE_INSET_X` / `TITLE_SAFE_INSET_Y`, 10% per side). Intended as a direct child of
 * [`HtmlCanvas`](./HtmlCanvas.tsx) (or any `position: relative` 1920×1080 root).
 */
export function LowerThird({
  children,
  className,
  justify = 'end',
  align = 'center',
  padding,
  paddingX,
  paddingY,
  paddingTop,
  paddingRight,
  paddingBottom,
  paddingLeft,
}: LowerThirdProps) {
  const horizontalInset = paddingX ?? padding ?? TITLE_SAFE_INSET_X
  const verticalInset = paddingY ?? padding ?? TITLE_SAFE_INSET_Y

  return (
    <Column position="absolute" top={0} left={0} width="100%" height="100%" className={className}>
      <Box grow={2} shrink={0} />
      <Column
        grow={1}
        shrink={0}
        justify={justify}
        align={align}
        paddingTop={paddingTop ?? verticalInset}
        paddingBottom={paddingBottom ?? verticalInset}
        paddingLeft={paddingLeft ?? horizontalInset}
        paddingRight={paddingRight ?? horizontalInset}
        width="100%"
        height="100%"
      >
        {children}
      </Column>
    </Column>
  )
}
