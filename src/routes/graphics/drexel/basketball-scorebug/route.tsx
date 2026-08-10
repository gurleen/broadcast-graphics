import { useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { HtmlCanvas } from '#/html/HtmlCanvas'
import { LowerThird } from '#/html/LowerThird'
import { Column, Row, Text, TexturedRect, BoundedImage } from '#/html/ui'
import { Colors, DefaultShadow, DefaultTextShadow } from '#/graphics/colors'
import { PREVIEW_TOOLBAR_SLOT_ID } from '#/graphics/GraphicStage'
import { darkenColor, toCssGradient } from '#/html/ui/gradient'

export const Route = createFileRoute('/graphics/drexel/basketball-scorebug')({
    component: BasketballScorebugGraphic,
})

const graphicsRoute = getRouteApi('/graphics')

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

const getLogoUrl = (team: string) => `https://images.dragonstv.io/logos-knockout/${team}.PNG`;

export type BasketballScorebugTeam = {
    teamCode: string
    primaryColor: string
    score: number | string
}

export type BasketballScorebugProps = {
    home: BasketballScorebugTeam
    away: BasketballScorebugTeam
    clock: string
    period: string
    shotClock: number | string
    shotClockColor?: string
}

export const basketballScorebugDefaultProps: BasketballScorebugProps = {
    home: {
        teamCode: 'DREXEL',
        primaryColor: Colors.DrexelPrimary,
        score: 88,
    },
    away: {
        teamCode: 'DELAWARE',
        primaryColor: Colors.DrexelSecondary,
        score: 88,
    },
    clock: '10:36',
    period: '2ND',
    shotClock: 24,
    shotClockColor: Colors.DrexelSecondary,
}

const teamGradient = (color: string, angle: number) =>
    toCssGradient({
        stops: [
            { offset: 0, color },
            { offset: 1, color: darkenColor(color, 0.3) },
        ],
        angle,
    })

const PERIOD_OPTIONS = ['1ST', '2ND', 'HALF', '3RD', '4TH', 'OT', '2OT'] as const

function clockToSeconds(clock: string): number {
    const [minutes, seconds] = clock.split(':').map((part) => Number.parseInt(part, 10))
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return 0
    return Math.max(0, minutes * 60 + seconds)
}

function secondsToClock(totalSeconds: number): string {
    const clamped = Math.max(0, totalSeconds)
    const minutes = Math.floor(clamped / 60)
    const seconds = clamped % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function numericScore(score: number | string): number {
    const value = typeof score === 'number' ? score : Number.parseInt(score, 10)
    return Number.isFinite(value) ? value : 0
}

const toolbarButtonClass =
    'rounded-md bg-slate-700 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-slate-600 disabled:opacity-40'

function PreviewToolbarControls({
    state,
    clockRunning,
    onClockRunningChange,
    onStateChange,
}: {
    state: BasketballScorebugProps
    clockRunning: boolean
    onClockRunningChange: (running: boolean) => void
    onStateChange: (patch: Partial<BasketballScorebugProps> | ((prev: BasketballScorebugProps) => BasketballScorebugProps)) => void
}) {
    const bumpScore = (side: 'home' | 'away', delta: number) => {
        onStateChange((prev) => ({
            ...prev,
            [side]: {
                ...prev[side],
                score: Math.max(0, numericScore(prev[side].score) + delta),
            },
        }))
    }

    const bumpShotClock = (delta: number) => {
        onStateChange((prev) => ({
            ...prev,
            shotClock: Math.max(0, numericScore(prev.shotClock) + delta),
        }))
    }

    return (
        <div className="flex max-w-[min(100vw,72rem)] flex-wrap items-center justify-center gap-x-4 gap-y-3 border-l border-slate-600 pl-4">
            <div className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Away</span>
                <button type="button" className={toolbarButtonClass} onClick={() => bumpScore('away', -1)}>
                    −
                </button>
                <span className="min-w-[2ch] text-center text-sm tabular-nums text-white">
                    {state.away.score}
                </span>
                <button type="button" className={toolbarButtonClass} onClick={() => bumpScore('away', 1)}>
                    +
                </button>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Home</span>
                <button type="button" className={toolbarButtonClass} onClick={() => bumpScore('home', -1)}>
                    −
                </button>
                <span className="min-w-[2ch] text-center text-sm tabular-nums text-white">
                    {state.home.score}
                </span>
                <button type="button" className={toolbarButtonClass} onClick={() => bumpScore('home', 1)}>
                    +
                </button>
            </div>
            <label className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Period</span>
                <select
                    className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-white"
                    value={state.period}
                    onChange={(e) => onStateChange({ period: e.target.value })}
                >
                    {PERIOD_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                            {option}
                        </option>
                    ))}
                </select>
            </label>
            <div className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Clock</span>
                <span className="min-w-14 text-center text-sm tabular-nums text-white">{state.clock}</span>
                <button
                    type="button"
                    className={toolbarButtonClass}
                    onClick={() => onClockRunningChange(!clockRunning)}
                >
                    {clockRunning ? 'Stop' : 'Start'}
                </button>
                <button
                    type="button"
                    className={toolbarButtonClass}
                    onClick={() => {
                        onClockRunningChange(false)
                        onStateChange({ clock: basketballScorebugDefaultProps.clock })
                    }}
                >
                    Reset
                </button>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Shot</span>
                <button type="button" className={toolbarButtonClass} onClick={() => bumpShotClock(-1)}>
                    −
                </button>
                <span className="min-w-[2ch] text-center text-sm tabular-nums text-white">{state.shotClock}</span>
                <button type="button" className={toolbarButtonClass} onClick={() => bumpShotClock(1)}>
                    +
                </button>
                <button
                    type="button"
                    className={toolbarButtonClass}
                    onClick={() => onStateChange({ shotClock: basketballScorebugDefaultProps.shotClock })}
                >
                    Reset
                </button>
            </div>
        </div>
    )
}

function InfoArea({
    clock,
    period,
    shotClock,
    shotClockColor = Colors.DrexelSecondary,
}: Pick<BasketballScorebugProps, 'clock' | 'period' | 'shotClock' | 'shotClockColor'>) {
    return (
        <TexturedRect width={100} height={130} src="/textures/brushed-metal.png" overlayOpacity={0.75} overlay={Colors.Black} className='rounded-r-xl'
            border={2} borderColor={Colors.Black}>
            <Column justify='around'>
                <Text shadow={DefaultTextShadow} className='font-bold tabular-nums font-family-dseg7' fontSize={24}>{clock}</Text>
                <Text shadow={DefaultTextShadow} fontFamily='Barlow' className='font-bold' fontSize={22} color={Colors.Steel}>{period}</Text>
                <Text shadow={DefaultTextShadow} fontFamily='Barlow' className='font-bold tabular-nums' fontSize={24} color={shotClockColor}>{shotClock}</Text>
            </Column>
        </TexturedRect>
    );
}

function TeamBox({ side, team }: { side: 'home' | 'away'; team: BasketballScorebugTeam }) {
    const gradientAngle = side === 'home' ? 270 : -90;
    const gradient = teamGradient(team.primaryColor, gradientAngle);
    const roundedCorner = side === 'away' ? 'rounded-tl-xl' : 'rounded-bl-xl';
    const borderColor = darkenColor(team.primaryColor, 0.3);
    const logoUrl = getLogoUrl(team.teamCode);


    return (
        <TexturedRect width={250} height={65} src="/textures/brushed-metal.png" overlay={gradient} overlayOpacity={0.8} className={roundedCorner}
            border={2} borderColor={borderColor}>
            <Row height='100%' justify='between' className='pe-2'>
                <motion.div variants={logoVariants} style={{ width: 100, height: 65, transformOrigin: 'left center' }}>
                    <BoundedImage width={100} height={65} imageWidth={200} src={logoUrl} x={-75} y={-75} />
                </motion.div>
                <motion.div variants={scoreVariants} style={{ transformOrigin: 'center' }}>
                    <Text shadow={DefaultTextShadow} fontFamily='Barlow' className='font-bold' fontSize={48} color={Colors.White}>{team.score}</Text>
                </motion.div>
            </Row>
        </TexturedRect>
    )
}

function BasketballScorebugGraphic() {
    const { preview } = graphicsRoute.useSearch()
    const [graphicState, setGraphicState] = useState<BasketballScorebugProps>(() => ({
        ...basketballScorebugDefaultProps,
        home: { ...basketballScorebugDefaultProps.home },
        away: { ...basketballScorebugDefaultProps.away },
    }))
    const { home, away, clock, period, shotClock, shotClockColor } = graphicState
    const [onScreen, setOnScreen] = useState(true)
    const [clockRunning, setClockRunning] = useState(false)
    const [toolbarSlot, setToolbarSlot] = useState<HTMLElement | null>(null)

    useLayoutEffect(() => {
        if (!preview) {
            setToolbarSlot(null)
            return
        }
        setToolbarSlot(document.getElementById(PREVIEW_TOOLBAR_SLOT_ID))
    }, [preview])

    useEffect(() => {
        if (!clockRunning) return

        const tick = window.setInterval(() => {
            setGraphicState((prev) => {
                const remaining = clockToSeconds(prev.clock)
                if (remaining <= 0) {
                    setClockRunning(false)
                    return prev
                }

                const nextClock = secondsToClock(remaining - 1)
                const shotRemaining = numericScore(prev.shotClock)
                const nextShot = shotRemaining > 0 ? shotRemaining - 1 : shotRemaining

                return {
                    ...prev,
                    clock: nextClock,
                    shotClock: nextShot,
                }
            })
        }, 1000)

        return () => window.clearInterval(tick)
    }, [clockRunning])

    return (
        <>
            <HtmlCanvas>
                <LowerThird align='end'>
                    <motion.div
                        variants={lowerThirdContainerVariants}
                        initial="hidden"
                        animate={onScreen ? 'visible' : 'hidden'}
                    >
                        <Row justify='end'>
                            <Column align='start' shadow={DefaultShadow}>
                                <motion.div
                                    variants={teamBoxVariants}
                                    style={{ transformOrigin: 'right center', transformPerspective: 900 }}
                                >
                                    <TeamBox side='away' team={away} />
                                </motion.div>
                                <motion.div
                                    variants={teamBoxVariants}
                                    style={{ transformOrigin: 'right center', transformPerspective: 900 }}
                                >
                                    <TeamBox side='home' team={home} />
                                </motion.div>
                            </Column>
                            <motion.div
                                variants={infoAreaVariants}
                                style={{ transformOrigin: 'left center', transformPerspective: 800 }}
                            >
                                <InfoArea clock={clock} period={period} shotClock={shotClock} shotClockColor={shotClockColor} />
                            </motion.div>
                        </Row>
                    </motion.div>
                </LowerThird>
            </HtmlCanvas>
            {toolbarSlot &&
                createPortal(
                    <div className="flex flex-wrap items-center justify-center gap-3">
                        <button
                            type="button"
                            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
                            onClick={() => setOnScreen(true)}
                        >
                            In
                        </button>
                        <button
                            type="button"
                            className="rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600"
                            onClick={() => setOnScreen(false)}
                        >
                            Out
                        </button>
                        <PreviewToolbarControls
                            state={graphicState}
                            clockRunning={clockRunning}
                            onClockRunningChange={setClockRunning}
                            onStateChange={(patch) => {
                                if (typeof patch === 'function') {
                                    setGraphicState(patch)
                                } else {
                                    setGraphicState((prev) => ({ ...prev, ...patch }))
                                }
                            }}
                        />
                    </div>,
                    toolbarSlot,
                )}
        </>
    )
}
