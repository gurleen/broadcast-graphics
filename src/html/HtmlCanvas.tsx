import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from 'react'

type HtmlCanvasProps = Omit<ComponentPropsWithoutRef<'div'>, 'children'> & {
  children?: ReactNode
}

export function HtmlCanvas({ children, style, ...rest }: HtmlCanvasProps) {
  // `GraphicStage` renders its content at a fixed 1920x1080 layout size and
  // shrinks it visually with a CSS `transform: scale()` to fit the viewport.
  // This root fills that untransformed layout box so HTML layouts share the
  // same broadcast frame as R3F routes using `GraphicCanvas`.
  const canvasStyle: CSSProperties = {
    position: 'relative',
    ...style,
    width: '100%',
    height: '100%',
    background: 'transparent',
  }

  return (
    <div style={canvasStyle} {...rest}>
      {children}
    </div>
  )
}
