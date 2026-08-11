import { Box } from './Box'
import type { BoxProps } from './Box'

export type RectProps = Omit<BoxProps, 'background'> & {
  /** Solid fill. Ignored (as a color) when `gradient` is also set. Defaults to white. */
  fill?: string
}

/** A leaf rounded rect: always paints, unlike `Box` which only paints when given a fill/gradient. */
export function Rect({ fill = '#ffffff', ...rest }: RectProps) {
  return <Box background={fill} {...rest} />
}
