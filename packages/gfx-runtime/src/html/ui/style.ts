import type { CSSProperties } from 'react'

/** A CSS-like length: pixels or a percentage of the parent's content box. */
export type LengthValue = number | `${number}%`
/** A length, or `'auto'` to let flex resolve it from content/flex rules. */
export type SizeValue = LengthValue | 'auto'
/** A margin edge, which additionally supports `'auto'` for centering tricks. */
export type MarginValue = LengthValue | 'auto'

export type FlexDirectionProp = 'row' | 'row-reverse' | 'column' | 'column-reverse'
export type WrapProp = 'nowrap' | 'wrap' | 'wrap-reverse'
export type JustifyProp = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'
export type AlignProp = 'auto' | 'start' | 'center' | 'end' | 'stretch' | 'baseline'
export type AlignContentProp = 'start' | 'center' | 'end' | 'stretch' | 'between' | 'around' | 'evenly'
export type PositionProp = 'relative' | 'absolute'
export type DisplayProp = 'flex' | 'none'

/**
 * CSS-flexbox-like style props shared by every layout-participating
 * HTML component (`Box`, `Flex`, `Row`, `Column`, `Text`, `Image`, `BoundedImage`, ...).
 */
export type StyleProps = {
  width?: SizeValue
  height?: SizeValue
  minWidth?: LengthValue
  minHeight?: LengthValue
  maxWidth?: LengthValue
  maxHeight?: LengthValue
  aspectRatio?: number

  padding?: LengthValue
  paddingX?: LengthValue
  paddingY?: LengthValue
  paddingTop?: LengthValue
  paddingRight?: LengthValue
  paddingBottom?: LengthValue
  paddingLeft?: LengthValue

  margin?: MarginValue
  marginX?: MarginValue
  marginY?: MarginValue
  marginTop?: MarginValue
  marginRight?: MarginValue
  marginBottom?: MarginValue
  marginLeft?: MarginValue

  gap?: LengthValue
  rowGap?: LengthValue
  columnGap?: LengthValue

  /** Main axis direction. Defaults to `'column'` (like React Native) unless a preset says otherwise. */
  direction?: FlexDirectionProp
  wrap?: WrapProp
  /** Alignment along the main axis. */
  justify?: JustifyProp
  /** Alignment along the cross axis. */
  align?: AlignProp
  /** Overrides `align` for this node only, as seen by its parent. */
  alignSelf?: AlignProp
  /** Alignment of wrapped lines along the cross axis. */
  alignContent?: AlignContentProp

  grow?: number
  shrink?: number
  basis?: SizeValue

  position?: PositionProp
  top?: LengthValue
  right?: LengthValue
  bottom?: LengthValue
  left?: LengthValue

  display?: DisplayProp

  zIndex?: number
}

const JUSTIFY_MAP: Record<JustifyProp, CSSProperties['justifyContent']> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
  evenly: 'space-evenly',
}

const ALIGN_MAP: Record<Exclude<AlignProp, 'auto'>, CSSProperties['alignItems']> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
  baseline: 'baseline',
}

const ALIGN_SELF_MAP: Record<AlignProp, CSSProperties['alignSelf']> = {
  auto: 'auto',
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
  baseline: 'baseline',
}

const ALIGN_CONTENT_MAP: Record<AlignContentProp, CSSProperties['alignContent']> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
  between: 'space-between',
  around: 'space-around',
  evenly: 'space-evenly',
}

function length(v: LengthValue | MarginValue | undefined): string | undefined {
  if (v == null) return undefined
  if (v === 'auto') return 'auto'
  if (typeof v === 'number') return `${v}px`
  return v
}

export function size(v: SizeValue | undefined): string | undefined {
  if (v == null) return undefined
  if (v === 'auto') return 'auto'
  return length(v)
}

function paddingEdges(style: StyleProps) {
  const { padding, paddingX, paddingY, paddingTop, paddingRight, paddingBottom, paddingLeft } = style
  return {
    paddingTop: length(paddingTop ?? paddingY ?? padding),
    paddingRight: length(paddingRight ?? paddingX ?? padding),
    paddingBottom: length(paddingBottom ?? paddingY ?? padding),
    paddingLeft: length(paddingLeft ?? paddingX ?? padding),
  }
}

function marginEdges(style: StyleProps) {
  const { margin, marginX, marginY, marginTop, marginRight, marginBottom, marginLeft } = style
  return {
    marginTop: length(marginTop ?? marginY ?? margin),
    marginRight: length(marginRight ?? marginX ?? margin),
    marginBottom: length(marginBottom ?? marginY ?? margin),
    marginLeft: length(marginLeft ?? marginX ?? margin),
  }
}

/** Flex item sizing/positioning without turning the node into a flex container. */
export function toFlexItemStyle(style: StyleProps): CSSProperties {
  const display = style.display === 'none' ? 'none' : undefined
  const flexShrink = style.shrink ?? 1

  return {
    display,
    boxSizing: 'border-box',
    position: style.position ?? 'relative',
    top: length(style.top),
    right: length(style.right),
    bottom: length(style.bottom),
    left: length(style.left),
    width: size(style.width),
    height: size(style.height),
    minWidth: length(style.minWidth),
    minHeight: length(style.minHeight),
    maxWidth: length(style.maxWidth),
    maxHeight: length(style.maxHeight),
    aspectRatio: style.aspectRatio,
    flexGrow: style.grow ?? 0,
    flexShrink,
    flexBasis: size(style.basis ?? 'auto'),
    alignSelf: ALIGN_SELF_MAP[style.alignSelf ?? 'auto'],
    ...paddingEdges(style),
    ...marginEdges(style),
    zIndex: style.zIndex,
  }
}

/** Flex container alignment and gap only (no `display: flex` — caller sets that). */
export function toFlexContainerStyle(style: StyleProps): CSSProperties {
  const rowGap = style.rowGap ?? style.gap
  const columnGap = style.columnGap ?? style.gap

  return {
    flexDirection: style.direction ?? 'column',
    flexWrap: style.wrap ?? 'nowrap',
    justifyContent: JUSTIFY_MAP[style.justify ?? 'start'],
    alignItems:
      style.align == null || style.align === 'auto'
        ? 'stretch'
        : ALIGN_MAP[style.align],
    alignContent: ALIGN_CONTENT_MAP[style.alignContent ?? 'stretch'],
    rowGap: length(rowGap),
    columnGap: length(columnGap),
  }
}

/** Full flex container styles for `Box` and similar. */
export function toFlexStyle(style: StyleProps): CSSProperties {
  const display = style.display === 'none' ? 'none' : 'flex'

  return {
    ...toFlexItemStyle({ ...style, display: style.display }),
    display,
    ...toFlexContainerStyle(style),
  }
}
