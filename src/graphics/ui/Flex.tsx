import { Box } from './Box'
import type { BoxProps } from './Box'

export type FlexProps = BoxProps

/** A `Box` defaulting to CSS flexbox's own default: row direction. */
export function Flex({ direction = 'row', ...props }: FlexProps) {
  return <Box direction={direction} {...props} />
}

export type RowProps = Omit<BoxProps, 'direction'>

/** A `Box` fixed to `direction="row"`. */
export function Row(props: RowProps) {
  return <Box direction="row" {...props} />
}

export type ColumnProps = Omit<BoxProps, 'direction'>

/** A `Box` fixed to `direction="column"`. */
export function Column(props: ColumnProps) {
  return <Box direction="column" {...props} />
}

export type SpacerProps = Omit<BoxProps, 'grow' | 'children'>

/** A flexible `Box` (`flexGrow: 1`) that eats up remaining space in a `Row`/`Column`. */
export function Spacer(props: SpacerProps) {
  return <Box grow={1} {...props} />
}
