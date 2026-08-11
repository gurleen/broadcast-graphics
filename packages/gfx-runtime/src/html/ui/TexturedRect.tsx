import type { ReactNode } from 'react'
import type { ObjectFit } from './Image'
import { Rect } from './Rect'
import type { RectProps } from './Rect'

export type TexturedRectProps = Omit<RectProps, 'fill' | 'gradient'> & {
  src: string
  /** How the texture is fit into the rect. Defaults to `'cover'`. */
  fit?: ObjectFit
  alt?: string
  /** Tint painted over the texture. CSS color or `linear-gradient(...)`. */
  overlay?: string
  /** Strength of `overlay`, 0–1. Defaults to `1`. */
  overlayOpacity?: number
  children?: ReactNode
}

/** A leaf rounded rect sampled from `src` instead of a solid fill or gradient. */
export function TexturedRect({
  src,
  fit = 'cover',
  alt = '',
  overlay,
  overlayOpacity = 1,
  children,
  className,
  ...rest
}: TexturedRectProps) {
  return (
    <Rect
      fill="transparent"
      className={['overflow-hidden', className].filter(Boolean).join(' ')}
      {...rest}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: fit,
          pointerEvents: 'none',
        }}
      />
      {overlay != null ? (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: overlay,
            opacity: overlayOpacity,
            pointerEvents: 'none',
          }}
        />
      ) : null}
      {children}
    </Rect>
  )
}
