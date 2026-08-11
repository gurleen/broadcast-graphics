import { Box } from './Box'
import type { BoxProps } from './Box'

export type FlexProps = BoxProps

/** A `Box` defaulting to CSS flexbox's own default: row direction. */
export function Flex({ direction = 'row', ...props }: FlexProps) {
  return <Box direction={direction} {...props} />
}

export type RowProps = Omit<BoxProps, 'direction'>

/** A `Box` fixed to `direction="row"`, defaulting to full width and centered content. */
export function Row({ width = '100%', justify = 'center', align = 'center', ...props }: RowProps) {
  return <Box direction="row" width={width} justify={justify} align={align} {...props} />
}

export type ColumnProps = Omit<BoxProps, 'direction'>

/** A `Box` fixed to `direction="column"`, defaulting to full height and centered content. */
export function Column({
  height = '100%',
  justify = 'center',
  align = 'center',
  ...props
}: ColumnProps) {
  return <Box direction="column" height={height} justify={justify} align={align} {...props} />
}

export type SpacerProps = Omit<BoxProps, 'grow' | 'children'>

/** A flexible `Box` (`flexGrow: 1`) that eats up remaining space in a `Row`/`Column`. */
export function Spacer(props: SpacerProps) {
  return <Box grow={1} {...props} />
}
