export const GRAPHIC_WIDTH = 1920
export const GRAPHIC_HEIGHT = 1080

/** Top-left pixel coords -> center-origin, y-up world coords. */
export function px(x: number, y: number): [number, number] {
  return [x - GRAPHIC_WIDTH / 2, GRAPHIC_HEIGHT / 2 - y]
}
