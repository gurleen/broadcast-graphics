import { useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Colors } from '#/graphics/colors'
import { useWebFont } from '#/html/ui'
import type { Rect } from './-layout'
import type { MatchSlot } from './-types'

const AVILOCK_BOLD_FONT = 'Avilock Bold'
const CONDENSED_BOLD_URL = '/fonts/BarlowCondensed-Bold.ttf'
const GOLD = Colors.DrexelSecondary

const STATE_STYLE: Record<MatchSlot['state'], {
    background: string
    borderColor: string
    borderStyle: 'solid' | 'dashed'
    boxShadow: string
    opacity: number
    nameColor: string
    wrestlerColor: string
}> = {
    pending: {
        background: 'rgba(10, 12, 22, 0.45)',
        borderColor: 'rgba(255, 255, 255, 0.35)',
        borderStyle: 'dashed',
        boxShadow: 'none',
        opacity: 1,
        nameColor: 'rgba(255, 255, 255, 0.4)',
        wrestlerColor: 'rgba(255, 255, 255, 0.3)',
    },
    undecided: {
        background: 'rgba(8, 10, 20, 0.72)',
        borderColor: 'rgba(255, 255, 255, 0.55)',
        borderStyle: 'solid',
        boxShadow: '0 6px 18px rgba(0, 0, 0, 0.45)',
        opacity: 1,
        nameColor: Colors.White,
        wrestlerColor: 'rgba(255, 255, 255, 0.75)',
    },
    winner: {
        background: `linear-gradient(135deg, rgba(255, 198, 0, 0.28), rgba(8, 10, 20, 0.82))`,
        borderColor: GOLD,
        borderStyle: 'solid',
        boxShadow: `0 0 26px rgba(255, 198, 0, 0.55)`,
        opacity: 1,
        nameColor: GOLD,
        wrestlerColor: Colors.White,
    },
    loser: {
        background: 'rgba(8, 10, 20, 0.55)',
        borderColor: 'rgba(255, 255, 255, 0.18)',
        borderStyle: 'solid',
        boxShadow: 'none',
        opacity: 0.4,
        nameColor: 'rgba(255, 255, 255, 0.6)',
        wrestlerColor: 'rgba(255, 255, 255, 0.45)',
    },
}

export const cardVariants = {
    hidden: (custom: { dx: number }) => ({
        opacity: 0,
        x: custom.dx,
        transition: { duration: 0.25 },
    }),
    visible: {
        opacity: 1,
        x: 0,
        transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
    },
} as const

const WINNER_GLOW = STATE_STYLE.winner.boxShadow

const winnerCelebrateTransition = {
    duration: 1.05,
    ease: 'easeInOut' as const,
    times: [0, 0.14, 0.28, 0.42, 0.56, 1],
}

const winnerCelebrateAnimate = {
    opacity: [1, 0.5, 1, 0.5, 1, 1],
    boxShadow: [
        WINNER_GLOW,
        '0 0 52px rgba(255, 198, 0, 1)',
        WINNER_GLOW,
        '0 0 52px rgba(255, 198, 0, 1)',
        WINNER_GLOW,
        WINNER_GLOW,
    ],
    borderColor: [GOLD, '#fff4a8', GOLD, '#fff4a8', GOLD, GOLD],
}

export function BracketCard({
    rect,
    slot,
    dx = 0,
    animate = 'visible',
}: {
    rect: Rect
    slot: MatchSlot
    /** Horizontal offset (px) to enter/exit from — cards slide in from their round's outer edge. */
    dx?: number
    animate?: 'visible' | 'hidden'
}) {
    const style = STATE_STYLE[slot.state]
    const condensedFont = useWebFont(CONDENSED_BOLD_URL)
    const prevStateRef = useRef(slot.state)
    const [winnerPulseKey, setWinnerPulseKey] = useState(0)

    useLayoutEffect(() => {
        if (slot.state === 'winner' && prevStateRef.current !== 'winner') {
            setWinnerPulseKey((key) => key + 1)
        }
        prevStateRef.current = slot.state
    }, [slot.state])

    const isWinner = slot.state === 'winner'

    return (
        <motion.div
            custom={{ dx }}
            variants={cardVariants}
            initial="hidden"
            animate={animate}
            style={{
                position: 'absolute',
                left: rect.x,
                top: rect.y,
                width: rect.width,
                height: rect.height,
                zIndex: 4,
            }}
        >
            <motion.div
                key={isWinner ? `winner-pulse-${winnerPulseKey}` : slot.state}
                animate={
                    isWinner
                        ? winnerCelebrateAnimate
                        : {
                              background: style.background,
                              borderColor: style.borderColor,
                              boxShadow: style.boxShadow,
                              opacity: style.opacity,
                          }
                }
                transition={isWinner ? winnerCelebrateTransition : { duration: 0.35, ease: 'easeInOut' as const }}
                style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: 8,
                    borderWidth: 2,
                    borderStyle: style.borderStyle,
                    background: isWinner ? STATE_STYLE.winner.background : style.background,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    paddingLeft: 16,
                    paddingRight: 16,
                    overflow: 'hidden',
                }}
            >
                {slot.team ? (
                    <>
                        <div
                            style={{
                                fontFamily: AVILOCK_BOLD_FONT,
                                fontSize: 27,
                                lineHeight: 1.05,
                                color: style.nameColor,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                transition: 'color 0.35s ease',
                            }}
                        >
                            {slot.team.name}
                        </div>
                        <div
                            style={{
                                marginTop: 4,
                                fontFamily: condensedFont,
                                fontWeight: 700,
                                fontSize: 16,
                                color: style.wrestlerColor,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                transition: 'color 0.35s ease',
                            }}
                        >
                            {slot.team.wrestlers.join(' & ')}
                        </div>
                    </>
                ) : (
                    <div
                        style={{
                            fontFamily: AVILOCK_BOLD_FONT,
                            fontSize: 22,
                            letterSpacing: '0.08em',
                            color: style.nameColor,
                        }}
                    >
                        TBD
                    </div>
                )}
            </motion.div>
        </motion.div>
    )
}
