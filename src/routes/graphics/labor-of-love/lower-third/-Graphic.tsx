import { useMemo } from 'react'
import { motion } from 'motion/react'
import { HtmlCanvas } from '#/html/HtmlCanvas'
import { Column } from '#/html/ui'
import { Colors } from '#/graphics/colors'
import { GRAPHIC_HEIGHT, GRAPHIC_WIDTH } from '#/graphics/constants'
import type { TemplateRenderProps } from '#/templates/types'
import type { LaborOfLoveLowerThirdProps } from './-schema'

const COLORED_LTH_BG_URL = '/textures/labor-of-love/by-design-colored-lth-bg.png'
const AVILOCK_BOLD_FONT = 'Avilock Bold'

const EASE_ENTER = [0.16, 1, 0.3, 1] as const
const EASE_EXIT = [0.55, 0, 0.85, 0.15] as const
const EASE_OVERSHOOT = [0.34, 1.56, 0.64, 1] as const

const TEXT_SHADOW = 'drop-shadow(rgba(0, 0, 0, 0.7) 0 10px 15px)'

const fullBleedImageStyle = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  width: GRAPHIC_WIDTH,
  height: GRAPHIC_HEIGHT,
  pointerEvents: 'none' as const,
}

const graphicVariants = {
  hidden: {
    opacity: 0,
    y: 500,
    transition: { duration: 0.75, ease: EASE_EXIT },
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.01 },
  },
} as const

const bgVariants = {
  hidden: {
    y: 500,
    opacity: 0,
  },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      y: { duration: 0.5, ease: EASE_ENTER },
      opacity: { duration: 1, ease: EASE_ENTER },
    },
  },
} as const

const lineVariants = {
  hidden: {
    transition: { staggerChildren: 0.05, staggerDirection: -1 },
  },
  visible: {
    transition: { staggerChildren: 0.05, delayChildren: 0.5 },
  },
} as const

const charVariants = {
  hidden: {
    opacity: 0,
    scale: 1.3,
    transition: { duration: 0.25, ease: EASE_EXIT },
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.3, ease: EASE_OVERSHOOT },
  },
} as const

function StaggeredLine({
  text,
  fontSize,
  animate,
}: {
  text: string
  fontSize: number
  animate: 'visible' | 'hidden'
}) {
  const chars = useMemo(() => Array.from(text), [text])
  if (!text) return null

  return (
    <motion.div
      variants={lineVariants}
      initial="hidden"
      animate={animate}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        fontFamily: AVILOCK_BOLD_FONT,
        fontSize,
        color: Colors.White,
        filter: TEXT_SHADOW,
        lineHeight: 1,
        zIndex: 3,
      }}
    >
      {chars.map((char, index) => (
        <motion.span
          key={`${index}-${char}`}
          variants={charVariants}
          style={{
            display: 'inline-block',
            whiteSpace: char === ' ' ? 'pre' : undefined,
          }}
        >
          {char === ' ' ? '\u00A0' : char}
        </motion.span>
      ))}
    </motion.div>
  )
}

export function LaborOfLoveLowerThirdGraphic({
  props,
  onScreen,
}: TemplateRenderProps<LaborOfLoveLowerThirdProps>) {
  const { workerName, championshipName } = props
  const textPaddingTop = championshipName ? 888 : 958
  const motionState = onScreen ? 'visible' : 'hidden'

  return (
    <HtmlCanvas>
      <motion.div
        variants={graphicVariants}
        initial="hidden"
        animate={motionState}
        style={{ position: 'relative', width: '100%', height: '100%' }}
      >
        <motion.img
          variants={bgVariants}
          initial="hidden"
          animate={motionState}
          src={COLORED_LTH_BG_URL}
          alt=""
          draggable={false}
          style={{ ...fullBleedImageStyle, zIndex: 0 }}
        />
        <Column
          position="absolute"
          top={0}
          left={0}
          width="100%"
          height="100%"
          align="center"
          paddingTop={textPaddingTop}
          gap={0}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '100%',
              gap: 0,
            }}
          >
            <StaggeredLine text={championshipName} fontSize={64} animate={motionState} />
            <StaggeredLine text={workerName} fontSize={128} animate={motionState} />
          </div>
        </Column>
      </motion.div>
    </HtmlCanvas>
  )
}
