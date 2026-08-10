import { cssBorderRadius } from './radius'
import type { CornerRadius } from './radius'
import { size, toFlexStyle } from './style'
import type { SizeValue, StyleProps } from './style'

export type ObjectFit = 'contain' | 'cover' | 'fill'

/**
 * Where the image sits within its box when it doesn't exactly fill it
 * (e.g. `fit="contain"`, or `fit="cover"` cropping a differently-shaped image).
 * Accepts CSS `object-position` keywords (`'center'`, `'top left'`, ...) or a
 * custom value (e.g. `'20% 80%'`).
 */
export type ObjectPosition =
  | 'center'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top left'
  | 'top right'
  | 'bottom left'
  | 'bottom right'
  | (string & {})

export type ImageProps = StyleProps & {
  src: string
  /** How the image is fit into its computed box. Defaults to `'cover'`. */
  fit?: ObjectFit
  /** Where the image is positioned within its box. Defaults to `'center'`. */
  objectPosition?: ObjectPosition
  radius?: CornerRadius
  opacity?: number
  alt?: string
  className?: string
  /**
   * Size of the `<img>` element itself, independent of the container's
   * bounds (set via `width`/`height`). Defaults to `'100%'`, filling the
   * container. Set to something other than the container's size (e.g. a
   * larger value) together with `objectPosition`/`fit` to crop the image
   * against a smaller, clipped container.
   */
  imageWidth?: SizeValue
  /** See {@link imageWidth}. Defaults to `'100%'`. */
  imageHeight?: SizeValue
}

const FIT_CLASS: Record<ObjectFit, string> = {
  contain: 'object-contain',
  cover: 'object-cover',
  fill: 'object-fill',
}

export function Image({
  src,
  fit = 'cover',
  objectPosition = 'center',
  radius,
  opacity = 1,
  alt = '',
  className,
  width,
  height,
  top,
  left,
  ...style
}: ImageProps) {
  return (
    <img
        src={src}
        alt={alt}
        width={width}
        className={className}
        draggable={false}
        style={{ top, left, position: 'relative' }}
      />
  )
}
