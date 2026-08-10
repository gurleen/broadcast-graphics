import { motion } from 'motion/react'
import { HtmlCanvas } from '#/html/HtmlCanvas'
import { LowerThird } from '#/html/LowerThird'
import { Column, Row, Text, TexturedRect, BoundedImage } from '#/html/ui'
import { Colors, DefaultShadow, DefaultTextShadow } from '#/graphics/colors'
import { darkenColor, toCssGradient } from '#/html/ui/gradient'
import type { TemplateRenderProps } from '#/templates/types'
import type { BasketballScorebugProps, BasketballScorebugTeam } from './-types'

const EASE_ENTER = [0.16, 1, 0.3, 1] as const
const EASE_EXIT = [0.55, 0, 0.85, 0.15] as const
const EASE_OVERSHOOT = [0.34, 1.56, 0.64, 1] as const

/** Orchestrates timing only — children carry their own visual entrance/exit. */
const lowerThirdContainerVariants = {
  hidden: {
    transition: { staggerChildren: 0.05, staggerDirection: -1, when: 'afterChildren' as const },
  },
  visible: {
    transition: { staggerChildren: 0.09, delayChildren: 0.04, when: 'beforeChildren' as const },
  },
} as const

const teamBoxVariants = {
  hidden: {
    opacity: 0,
    x: 70,
    rotateY: 62,
    z: -140,
    filter: 'blur(8px) brightness(0.65)',
    transition: { duration: 0.3, ease: EASE_EXIT, staggerChildren: 0.04, staggerDirection: -1 },
  },
  visible: {
    opacity: 1,
    x: 0,
    rotateY: 0,
    z: 0,
    filter: 'blur(0px) brightness(1)',
    transition: { duration: 0.55, ease: EASE_OVERSHOOT, staggerChildren: 0.07, delayChildren: 0.18 },
  },
} as const

const logoVariants = {
  hidden: {
    opacity: 0,
    x: -24,
    scale: 0.7,
    rotate: -6,
    transition: { duration: 0.22, ease: EASE_EXIT },
  },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    rotate: 0,
    transition: { duration: 0.4, ease: EASE_OVERSHOOT },
  },
} as const

const scoreVariants = {
  hidden: {
    opacity: 0,
    scale: 0.4,
    y: 8,
    transition: { duration: 0.2, ease: EASE_EXIT },
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.4, ease: EASE_OVERSHOOT },
  },
} as const

const infoAreaVariants = {
  hidden: {
    opacity: 0,
    x: 40,
    rotateY: -55,
    transition: { duration: 0.28, ease: EASE_EXIT },
  },
  visible: {
    opacity: 1,
    x: 0,
    rotateY: 0,
    transition: { duration: 0.5, ease: EASE_ENTER },
  },
} as const

const getLogoUrl = (team: string) => `https://images.dragonstv.io/logos-knockout/${team}.PNG`

const teamGradient = (color: string, angle: number) =>
  toCssGradient({
    stops: [
      { offset: 0, color },
      { offset: 1, color: darkenColor(color, 0.3) },
    ],
    angle,
  })

function InfoArea({
  clock,
  period,
  shotClock,
  shotClockColor = Colors.DrexelSecondary,
}: Pick<BasketballScorebugProps, 'clock' | 'period' | 'shotClock' | 'shotClockColor'>) {
  return (
    <TexturedRect
      width={100}
      height={130}
      src="/textures/brushed-metal.png"
      overlayOpacity={0.75}
      overlay={Colors.Black}
      className="rounded-r-xl"
      border={2}
      borderColor={Colors.Black}
    >
      <Column justify="around">
        <Text
          shadow={DefaultTextShadow}
          className="font-bold tabular-nums font-family-dseg7"
          fontSize={24}
        >
          {clock}
        </Text>
        <Text
          shadow={DefaultTextShadow}
          fontFamily="Barlow"
          className="font-bold"
          fontSize={22}
          color={Colors.Steel}
        >
          {period}
        </Text>
        <Text
          shadow={DefaultTextShadow}
          fontFamily="Barlow"
          className="font-bold tabular-nums"
          fontSize={24}
          color={shotClockColor}
        >
          {shotClock}
        </Text>
      </Column>
    </TexturedRect>
  )
}

function TeamBox({ side, team }: { side: 'home' | 'away'; team: BasketballScorebugTeam }) {
  const gradientAngle = side === 'home' ? 270 : -90
  const gradient = teamGradient(team.primaryColor, gradientAngle)
  const roundedCorner = side === 'away' ? 'rounded-tl-xl' : 'rounded-bl-xl'
  const borderColor = darkenColor(team.primaryColor, 0.3)
  const logoUrl = getLogoUrl(team.teamCode)

  return (
    <TexturedRect
      width={250}
      height={65}
      src="/textures/brushed-metal.png"
      overlay={gradient}
      overlayOpacity={0.8}
      className={roundedCorner}
      border={2}
      borderColor={borderColor}
    >
      <Row height="100%" justify="between" className="pe-2">
        <motion.div variants={logoVariants} style={{ width: 100, height: 65, transformOrigin: 'left center' }}>
          <BoundedImage width={100} height={65} imageWidth={200} src={logoUrl} x={-75} y={-75} />
        </motion.div>
        <motion.div variants={scoreVariants} style={{ transformOrigin: 'center' }}>
          <Text
            shadow={DefaultTextShadow}
            fontFamily="Barlow"
            className="font-bold"
            fontSize={48}
            color={Colors.White}
          >
            {team.score}
          </Text>
        </motion.div>
      </Row>
    </TexturedRect>
  )
}

export function BasketballScorebugGraphic({
  props,
  onScreen,
}: TemplateRenderProps<BasketballScorebugProps>) {
  const { home, away, clock, period, shotClock, shotClockColor } = props

  return (
    <HtmlCanvas>
      <LowerThird align="end">
        <motion.div
          variants={lowerThirdContainerVariants}
          initial="hidden"
          animate={onScreen ? 'visible' : 'hidden'}
        >
          <Row justify="end">
            <Column align="start" shadow={DefaultShadow}>
              <motion.div
                variants={teamBoxVariants}
                style={{ transformOrigin: 'right center', transformPerspective: 900 }}
              >
                <TeamBox side="away" team={away} />
              </motion.div>
              <motion.div
                variants={teamBoxVariants}
                style={{ transformOrigin: 'right center', transformPerspective: 900 }}
              >
                <TeamBox side="home" team={home} />
              </motion.div>
            </Column>
            <motion.div
              variants={infoAreaVariants}
              style={{ transformOrigin: 'left center', transformPerspective: 800 }}
            >
              <InfoArea
                clock={clock}
                period={period}
                shotClock={shotClock}
                shotClockColor={shotClockColor}
              />
            </motion.div>
          </Row>
        </motion.div>
      </LowerThird>
    </HtmlCanvas>
  )
}
