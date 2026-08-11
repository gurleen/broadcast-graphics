import { Image } from './Image'
import type { ImageProps } from './Image'

export type BoundedImageProps = ImageProps & {
  x: number;
  y: number;
}

/**
 * An {@link Image} clipped to a rectangular bounds. Overflow is hidden.
 * By default the bounds match the parent (`width` and `height` are `'100%'`).
 *
 * `width`/`height` size the clipping container, while `imageWidth`/
 * `imageHeight` size the `<img>` element inside it (defaulting to `'100%'`
 * of the container). Give the image a different size than the container
 * (e.g. larger) along with `objectPosition` to crop/anchor it manually,
 * beyond what `fit` alone can do.
 *
 * Use `fit` to control how the image scales into its own box, and
 * `objectPosition` to control which part of the image is shown/anchored
 * when it doesn't exactly fill that box (e.g. `objectPosition="top"` to
 * keep the top of a `fit="cover"` image visible instead of cropping it
 * centered).
 */
export function BoundedImage({
  width = '100%',
  height = '100%',
  x,
  y,
  imageHeight,
  imageWidth,
  ...props
}: BoundedImageProps) {
  return (
    <div className='overflow-hidden' style={{ width, height }}>
      <Image
        width={imageWidth}
        height={imageHeight}
        top={y}
        left={x}
        {...props}
      />
    </div>
  )
}
