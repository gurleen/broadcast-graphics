import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { HtmlCanvas, GRAPHIC_WIDTH, GRAPHIC_HEIGHT } from '@hydra-tv/hydra-gfx-runtime'
import type { TemplateRenderProps } from '@hydra-tv/hydra-gfx-runtime/types'
import type { ExampleTickerProps } from './schema'

/**
 * Imperative GSAP timeline driven by `onScreen`. gsap is bundled into the
 * package artifact (not listed in hydra.config shared), proving the
 * bring-your-own-animation-library path.
 *
 * Marquee position is advanced on the GSAP ticker (not a from/to tween), so
 * live-data message swaps update the text in place without snapping x back to 0.
 */
export default function ExampleGsapTicker({
  props,
  onScreen,
}: TemplateRenderProps<ExampleTickerProps>) {
  const rootRef = useRef<HTMLDivElement>(null)
  const marqueeRef = useRef<HTMLDivElement>(null)
  const inOutTlRef = useRef<gsap.core.Timeline | null>(null)
  const speedRef = useRef(props.speed)
  const onScreenRef = useRef(onScreen)
  speedRef.current = props.speed
  onScreenRef.current = onScreen

  useEffect(() => {
    const el = rootRef.current
    if (!el) return

    const tl = gsap.timeline({ paused: true })
    tl.fromTo(
      el,
      { y: 60, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' },
    )
    inOutTlRef.current = tl
    if (onScreen) tl.play()
    return () => {
      tl.kill()
      inOutTlRef.current = null
    }
    // onScreen is read once to resume after mount; toggles use the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const tl = inOutTlRef.current
    if (!tl) return
    if (onScreen) tl.play()
    else tl.pause(0).reverse()
  }, [onScreen])

  // Continuous crawl — position survives message changes; width/speed read live.
  useEffect(() => {
    const marquee = marqueeRef.current
    if (!marquee) return

    let x = Number(gsap.getProperty(marquee, 'x')) || 0

    const tick = (_time: number, deltaMs: number) => {
      if (!onScreenRef.current) return
      const travel = Math.max(marquee.scrollWidth, GRAPHIC_WIDTH)
      const pxPerSec = 160 * Math.max(speedRef.current, 0.1)
      x -= (pxPerSec * deltaMs) / 1000
      if (travel > 0) {
        while (x <= -travel) x += travel
        while (x > 0) x -= travel
      }
      gsap.set(marquee, { x })
    }

    gsap.ticker.add(tick)
    return () => {
      gsap.ticker.remove(tick)
    }
  }, [])

  return (
    <HtmlCanvas>
      <div
        ref={rootRef}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: GRAPHIC_HEIGHT * 0.06,
          height: 56,
          background: 'rgba(7, 41, 77, 0.92)',
          borderTop: '3px solid #FFC600',
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
          opacity: 0,
          pointerEvents: 'none',
        }}
      >
        <div
          ref={marqueeRef}
          data-marquee
          style={{
            whiteSpace: 'nowrap',
            paddingLeft: GRAPHIC_WIDTH,
            fontFamily: 'system-ui, sans-serif',
            fontSize: 28,
            fontWeight: 700,
            color: '#FFFFFF',
            letterSpacing: '0.04em',
          }}
        >
          {props.message}
        </div>
      </div>
    </HtmlCanvas>
  )
}

// Deliberate: module-scope side effect that would break Bun schema import if
// this module were eagerly evaluated. The lazy Render factory must keep this
// from running during server-side package introspection.
if (typeof document === 'undefined' && typeof process !== 'undefined') {
  // no-op marker for tests — real DOM-touching libs would throw here
}
