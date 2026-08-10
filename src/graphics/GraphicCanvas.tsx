import { Canvas, type CanvasProps } from '@react-three/fiber'

type GraphicCanvasProps = Omit<CanvasProps, 'orthographic' | 'camera' | 'dpr'> &
  Pick<CanvasProps, 'children'>

export function GraphicCanvas({ children, ...rest }: GraphicCanvasProps) {
  return (
    <Canvas
      orthographic
      camera={{ position: [0, 0, 1000], near: 0.1, far: 2000, zoom: 1 }}
      dpr={1}
      gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true, localClippingEnabled: true }}
      style={{ background: 'transparent', width: '100%', height: '100%' }}
      // `GraphicStage` renders its content at a fixed 1920x1080 layout size and
      // shrinks it visually with a CSS `transform: scale()` to fit the viewport.
      // react-use-measure's default `getBoundingClientRect()` reflects that CSS
      // transform, so on smaller windows R3F would think the canvas is much
      // smaller than 1920x1080 and size the (unconfigured) orthographic camera
      // frustum to match — pushing all of our absolutely-positioned content
      // outside the visible view. `offsetSize` measures the untransformed
      // layout box instead, keeping the camera locked to the real 1920x1080
      // pixel space regardless of display scale.
      resize={{ offsetSize: true }}
      {...rest}
    >
      {children}
    </Canvas>
  )
}
