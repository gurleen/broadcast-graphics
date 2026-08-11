import { motion } from 'motion/react'
import { HtmlCanvas, GRAPHIC_WIDTH, GRAPHIC_HEIGHT } from '@hydra-tv/hydra-gfx-runtime'
import type { TemplateRenderProps } from '@hydra-tv/hydra-gfx-runtime/types'
import type { ExampleLowerThirdProps } from './schema'

export default function ExampleLowerThirdGraphic({
  props,
  onScreen,
}: TemplateRenderProps<ExampleLowerThirdProps>) {
  return (
    <HtmlCanvas>
      <motion.div
        initial={false}
        animate={onScreen ? 'visible' : 'hidden'}
        variants={{
          hidden: { opacity: 0, y: 80, transition: { duration: 0.4 } },
          visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] },
          },
        }}
        style={{
          position: 'absolute',
          left: GRAPHIC_WIDTH * 0.08,
          bottom: GRAPHIC_HEIGHT * 0.12,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            height: 4,
            width: 120,
            background: props.accent,
            marginBottom: 8,
          }}
        />
        <div
          style={{
            fontFamily: 'system-ui, sans-serif',
            fontSize: 64,
            fontWeight: 800,
            color: '#FFFFFF',
            textShadow: '0 4px 18px rgba(0,0,0,0.65)',
            lineHeight: 1.05,
          }}
        >
          {props.title}
        </div>
        <div
          style={{
            fontFamily: 'system-ui, sans-serif',
            fontSize: 28,
            fontWeight: 500,
            color: props.accent,
            textShadow: '0 2px 12px rgba(0,0,0,0.55)',
          }}
        >
          {props.subtitle}
        </div>
      </motion.div>
    </HtmlCanvas>
  )
}
