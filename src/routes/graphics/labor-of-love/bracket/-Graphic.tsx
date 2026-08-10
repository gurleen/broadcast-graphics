import { Fragment, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { HtmlCanvas } from '#/html/HtmlCanvas'
import { useWebFont } from '#/html/ui'
import { Colors } from '#/graphics/colors'
import { GRAPHIC_HEIGHT, GRAPHIC_WIDTH } from '#/graphics/constants'
import type { TemplateRenderProps } from '#/templates/types'
import { BracketCard } from './-BracketCard'
import { Connectors } from './-Connectors'
import { CHAMPION_RECT, FINAL_RECTS, QF_RECTS, ROUND_LABEL_Y, SF_RECTS } from './-layout'
import { resolveBracket, type LaborOfLoveBracketProps } from './-types'

const BG_URL = '/textures/labor-of-love/by-design-full-screen-bg.png'
const AVILOCK_BOLD_FONT = 'Avilock Bold'
const CONDENSED_BOLD_URL = '/fonts/BarlowCondensed-Bold.ttf'
const GOLD = Colors.DrexelSecondary

const EASE_ENTER = [0.16, 1, 0.3, 1] as const
const EASE_EXIT = [0.55, 0, 0.85, 0.15] as const
const EASE_OVERSHOOT = [0.34, 1.56, 0.64, 1] as const

const fullBleedStyle = {
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
    transition: { duration: 0.4, ease: EASE_EXIT },
  },
  visible: {
    opacity: 1,
    transition: { duration: 0.01 },
  },
} as const

const bgVariants = {
  hidden: { opacity: 0, scale: 1.1 },
  visible: {
    opacity: 1,
    scale: 1.05,
    transition: { duration: 0.9, ease: EASE_ENTER },
  },
} as const

const headerVariants = {
  hidden: { opacity: 0, y: -30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: EASE_OVERSHOOT },
  },
} as const

const championVariants = {
  hidden: { opacity: 0, scale: 0.85, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.55, ease: EASE_OVERSHOOT, delay: 0.35 },
  },
} as const

const ROUND_LABEL_STYLE = {
  position: 'absolute' as const,
  top: ROUND_LABEL_Y,
  width: 300,
  textAlign: 'center' as const,
  fontSize: 20,
  fontWeight: 700,
  letterSpacing: '0.16em',
  color: 'rgba(255, 255, 255, 0.65)',
  textTransform: 'uppercase' as const,
  zIndex: 3,
}

function ChampionPlate({
  champion,
  animate,
}: {
  champion: ReturnType<typeof resolveBracket>['champion']
  animate: 'visible' | 'hidden'
}) {
  const condensedFont = useWebFont(CONDENSED_BOLD_URL)
  const prevChampionRef = useRef(champion?.name ?? null)
  const [celebrateKey, setCelebrateKey] = useState(0)

  useLayoutEffect(() => {
    const name = champion?.name ?? null
    if (name != null && prevChampionRef.current !== name) {
      setCelebrateKey((key) => key + 1)
    }
    prevChampionRef.current = name
  }, [champion?.name])

  const championGlow = '0 0 40px rgba(255, 198, 0, 0.5)'
  const championBorder = champion ? GOLD : 'rgba(255, 255, 255, 0.3)'

  return (
    <motion.div
      variants={championVariants}
      initial="hidden"
      animate={animate}
      style={{
        position: 'absolute',
        left: CHAMPION_RECT.x,
        top: CHAMPION_RECT.y,
        width: CHAMPION_RECT.width,
        height: CHAMPION_RECT.height,
        zIndex: 5,
      }}
    >
      <motion.div
        key={champion ? `champion-${celebrateKey}` : 'no-champion'}
        animate={
          champion
            ? {
                opacity: [1, 0.55, 1, 0.55, 1, 1],
                boxShadow: [
                  championGlow,
                  '0 0 64px rgba(255, 198, 0, 1)',
                  championGlow,
                  '0 0 64px rgba(255, 198, 0, 1)',
                  championGlow,
                  championGlow,
                ],
                borderColor: [GOLD, '#fff4a8', GOLD, '#fff4a8', GOLD, GOLD],
              }
            : {
                opacity: 1,
                boxShadow: 'none',
                borderColor: 'rgba(255, 255, 255, 0.3)',
              }
        }
        transition={
          champion
            ? { duration: 1.15, ease: 'easeInOut', times: [0, 0.14, 0.28, 0.42, 0.56, 1] }
            : { duration: 0.35, ease: 'easeInOut' as const }
        }
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 12,
          borderWidth: 2,
          borderStyle: 'solid',
          borderColor: championBorder,
          background: champion
            ? 'linear-gradient(160deg, rgba(255, 198, 0, 0.32), rgba(6, 8, 16, 0.88))'
            : 'rgba(8, 10, 20, 0.55)',
          boxShadow: champion ? championGlow : 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        <div
          style={{
            fontFamily: condensedFont,
            fontWeight: 700,
            fontSize: 16,
            letterSpacing: '0.2em',
            color: champion ? GOLD : 'rgba(255, 255, 255, 0.5)',
            textTransform: 'uppercase',
          }}
        >
          Commonwealth Cup Champion
        </div>
        <div
          style={{
            fontFamily: AVILOCK_BOLD_FONT,
            fontSize: 34,
            lineHeight: 1,
            color: champion ? Colors.White : 'rgba(255, 255, 255, 0.35)',
          }}
        >
          {champion ? champion.name : 'TBD'}
        </div>
        {champion ? (
          <div
            style={{
              fontFamily: condensedFont,
              fontWeight: 700,
              fontSize: 17,
              color: 'rgba(255, 255, 255, 0.85)',
            }}
          >
            {champion.wrestlers.join(' & ')}
          </div>
        ) : null}
      </motion.div>
    </motion.div>
  )
}

export function LaborOfLoveBracketGraphic({
  props,
  onScreen,
}: TemplateRenderProps<LaborOfLoveBracketProps>) {
  const condensedFont = useWebFont(CONDENSED_BOLD_URL)
  const motionState = onScreen ? 'visible' : 'hidden'
  const resolved = useMemo(() => resolveBracket(props), [props])

  return (
    <HtmlCanvas>
      <motion.div
        variants={graphicVariants}
        initial="hidden"
        animate={motionState}
        style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
      >
        <motion.img
          variants={bgVariants}
          src={BG_URL}
          alt=""
          draggable={false}
          style={{ ...fullBleedStyle, zIndex: 0, filter: 'blur(7px) brightness(0.55)' }}
        />
        <div
          style={{
            ...fullBleedStyle,
            zIndex: 1,
            background:
              'radial-gradient(ellipse at center, rgba(0, 0, 0, 0) 32%, rgba(0, 0, 0, 0.6) 100%)',
          }}
        />

        <motion.div
          variants={headerVariants}
          initial="hidden"
          animate={motionState}
          style={{
            position: 'absolute',
            top: 24,
            left: 0,
            width: '100%',
            zIndex: 3,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontFamily: condensedFont,
              fontWeight: 700,
              fontSize: 26,
              letterSpacing: '0.3em',
              color: 'rgba(255, 255, 255, 0.8)',
              textTransform: 'uppercase',
            }}
          >
            {props.eventName}
          </div>
          <div
            style={{
              fontFamily: AVILOCK_BOLD_FONT,
              fontSize: 64,
              lineHeight: 1.05,
              color: Colors.White,
              filter: 'drop-shadow(rgba(0, 0, 0, 0.7) 0 8px 14px)',
            }}
          >
            {props.bracketName}
          </div>
        </motion.div>

        <div style={{ ...ROUND_LABEL_STYLE, left: QF_RECTS[0].a.x }}>Quarterfinals</div>
        <div style={{ ...ROUND_LABEL_STYLE, left: QF_RECTS[2].a.x }}>Quarterfinals</div>
        <div style={{ ...ROUND_LABEL_STYLE, left: SF_RECTS[0].a.x }}>Semifinals</div>
        <div style={{ ...ROUND_LABEL_STYLE, left: SF_RECTS[1].a.x }}>Semifinals</div>
        <div style={{ ...ROUND_LABEL_STYLE, left: FINAL_RECTS.a.x }}>Final</div>

        <Connectors resolved={resolved} animate={motionState} />

        {resolved.qf.map((match, index) => {
          const dx = index < 2 ? -60 : 60
          return (
            <Fragment key={`qf-${index}`}>
              <BracketCard rect={QF_RECTS[index].a} slot={match.a} dx={dx} animate={motionState} />
              <BracketCard rect={QF_RECTS[index].b} slot={match.b} dx={dx} animate={motionState} />
            </Fragment>
          )
        })}

        {resolved.sf.map((match, index) => {
          const dx = index === 0 ? -60 : 60
          return (
            <Fragment key={`sf-${index}`}>
              <BracketCard rect={SF_RECTS[index].a} slot={match.a} dx={dx} animate={motionState} />
              <BracketCard rect={SF_RECTS[index].b} slot={match.b} dx={dx} animate={motionState} />
            </Fragment>
          )
        })}

        <BracketCard rect={FINAL_RECTS.a} slot={resolved.final.a} dx={-60} animate={motionState} />
        <BracketCard rect={FINAL_RECTS.b} slot={resolved.final.b} dx={60} animate={motionState} />

        <motion.div
          variants={headerVariants}
          initial="hidden"
          animate={motionState}
          style={{
            position: 'absolute',
            left: FINAL_RECTS.a.x,
            top: FINAL_RECTS.a.y + FINAL_RECTS.a.height,
            width: FINAL_RECTS.a.width,
            height: FINAL_RECTS.b.y - (FINAL_RECTS.a.y + FINAL_RECTS.a.height),
            zIndex: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: AVILOCK_BOLD_FONT,
            fontSize: 36,
            letterSpacing: '0.12em',
            color: GOLD,
            filter: 'drop-shadow(0 0 12px rgba(255, 198, 0, 0.45))',
            pointerEvents: 'none',
          }}
        >
          VS
        </motion.div>

        <ChampionPlate champion={resolved.champion} animate={motionState} />
      </motion.div>
    </HtmlCanvas>
  )
}
