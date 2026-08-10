import { Align, Display, Edge, FlexDirection, Gutter, Justify, PositionType, Wrap } from 'yoga-layout/load'
import type { Node as YogaNode } from 'yoga-layout/load'

/** A CSS-like length: pixels or a percentage of the parent's content box. */
export type LengthValue = number | `${number}%`
/** A length, or `'auto'` to let yoga resolve it from content/flex rules. */
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
 * component (`Box`, `Flex`, `Row`, `Column`, `Text`, `Image`, `Clip`, ...).
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

  /** Overrides document-order paint stacking with an explicit `renderOrder`. */
  zIndex?: number
}

const JUSTIFY_MAP: Record<JustifyProp, Justify> = {
  start: Justify.FlexStart,
  center: Justify.Center,
  end: Justify.FlexEnd,
  between: Justify.SpaceBetween,
  around: Justify.SpaceAround,
  evenly: Justify.SpaceEvenly,
}

const ALIGN_MAP: Record<AlignProp, Align> = {
  auto: Align.Auto,
  start: Align.FlexStart,
  center: Align.Center,
  end: Align.FlexEnd,
  stretch: Align.Stretch,
  baseline: Align.Baseline,
}

const ALIGN_CONTENT_MAP: Record<AlignContentProp, Align> = {
  start: Align.FlexStart,
  center: Align.Center,
  end: Align.FlexEnd,
  stretch: Align.Stretch,
  between: Align.SpaceBetween,
  around: Align.SpaceAround,
  evenly: Align.SpaceEvenly,
}

const FLEX_DIRECTION_MAP: Record<FlexDirectionProp, FlexDirection> = {
  row: FlexDirection.Row,
  'row-reverse': FlexDirection.RowReverse,
  column: FlexDirection.Column,
  'column-reverse': FlexDirection.ColumnReverse,
}

const WRAP_MAP: Record<WrapProp, Wrap> = {
  nowrap: Wrap.NoWrap,
  wrap: Wrap.Wrap,
  'wrap-reverse': Wrap.WrapReverse,
}

const POSITION_MAP: Record<PositionProp, PositionType> = {
  relative: PositionType.Relative,
  absolute: PositionType.Absolute,
}

const DISPLAY_MAP: Record<DisplayProp, Display> = {
  flex: Display.Flex,
  none: Display.None,
}

function applyPadding(node: YogaNode, style: StyleProps) {
  const { padding, paddingX, paddingY, paddingTop, paddingRight, paddingBottom, paddingLeft } = style
  node.setPadding(Edge.Top, paddingTop ?? paddingY ?? padding)
  node.setPadding(Edge.Right, paddingRight ?? paddingX ?? padding)
  node.setPadding(Edge.Bottom, paddingBottom ?? paddingY ?? padding)
  node.setPadding(Edge.Left, paddingLeft ?? paddingX ?? padding)
}

function applyMargin(node: YogaNode, style: StyleProps) {
  const { margin, marginX, marginY, marginTop, marginRight, marginBottom, marginLeft } = style
  node.setMargin(Edge.Top, marginTop ?? marginY ?? margin)
  node.setMargin(Edge.Right, marginRight ?? marginX ?? margin)
  node.setMargin(Edge.Bottom, marginBottom ?? marginY ?? margin)
  node.setMargin(Edge.Left, marginLeft ?? marginX ?? margin)
}

function applyInset(node: YogaNode, style: StyleProps) {
  node.setPositionType(POSITION_MAP[style.position ?? 'relative'])
  node.setPosition(Edge.Top, style.top)
  node.setPosition(Edge.Right, style.right)
  node.setPosition(Edge.Bottom, style.bottom)
  node.setPosition(Edge.Left, style.left)
}

/** Applies every supported `StyleProps` field onto a yoga node, resetting anything omitted. */
export function applyStyle(node: YogaNode, style: StyleProps) {
  node.setFlexDirection(FLEX_DIRECTION_MAP[style.direction ?? 'column'])
  node.setFlexWrap(WRAP_MAP[style.wrap ?? 'nowrap'])
  node.setJustifyContent(JUSTIFY_MAP[style.justify ?? 'start'])
  node.setAlignItems(ALIGN_MAP[style.align ?? 'stretch'])
  node.setAlignContent(ALIGN_CONTENT_MAP[style.alignContent ?? 'stretch'])
  node.setAlignSelf(ALIGN_MAP[style.alignSelf ?? 'auto'])

  node.setWidth(style.width ?? 'auto')
  node.setHeight(style.height ?? 'auto')
  node.setMinWidth(style.minWidth)
  node.setMinHeight(style.minHeight)
  node.setMaxWidth(style.maxWidth)
  node.setMaxHeight(style.maxHeight)
  node.setAspectRatio(style.aspectRatio)

  node.setFlexGrow(style.grow ?? 0)
  node.setFlexShrink(style.shrink)
  node.setFlexBasis(style.basis ?? 'auto')

  applyPadding(node, style)
  applyMargin(node, style)

  node.setGap(Gutter.Row, style.rowGap ?? style.gap)
  node.setGap(Gutter.Column, style.columnGap ?? style.gap)

  applyInset(node, style)

  node.setDisplay(DISPLAY_MAP[style.display ?? 'flex'])
}
