import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { HtmlCanvas, GRAPHIC_WIDTH, GRAPHIC_HEIGHT } from '@hydra/gfx-runtime'
import type { TemplateRenderProps } from '@hydra/gfx-runtime/types'
import type { ExampleTickerProps } from './schema'

/**
 * Imperative GSAP timeline driven by `onScreen`. gsap is bundled into the
 * package artifact (not listed in hydra.config shared), proving the
 * bring-your-own-animation-library path.
 */
export default function ExampleGsapTicker({
  props,
  onScreen,
}: TemplateRenderProps<ExampleTickerProps>) {
  const rootRef = useRef<HTMLDivElement>(null)
  const tlRef = useRef<gsap.core.Timeline | null>(null)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return

    const tl = gsap.timeline({ paused: true })
    tl.fromTo(
      el,
      { y: 60, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' },
      0,
    )
    tl.to(
      el.querySelector('[data-marquee]'),
      {
        x: -200,
        duration: 4 / Math.max(props.speed, 0.1),
        ease: 'none',
        repeat: -1,
      },
      0.3,
    )
    tlRef.current = tl
    return () => {
      tl.kill()
      tlRef.current = null
    }
  }, [props.speed, props.message])

  useEffect(() => {
    const tl = tlRef.current
    if (!tl) return
    if (onScreen) tl.play()
    else tl.pause(0).reverse()
  }, [onScreen])

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
