import { motion } from 'motion/react'
import { Colors } from '#/graphics/colors'
import { GRAPHIC_HEIGHT, GRAPHIC_WIDTH } from '#/graphics/constants'
import {
    CHAMPION_RECT,
    championConnectorPath,
    elbowConnectorPath,
    FINAL_RECTS,
    QF_RECTS,
    SF_RECTS,
} from './-layout'
import type { ResolvedBracket, ResolvedMatch } from './-types'

const GOLD = Colors.DrexelSecondary
const DIM_STROKE = 'rgba(255, 255, 255, 0.28)'

const pathVariants = {
    // Opacity-only: pathLength breaks on multi-subpath elbows (disjoint M commands).
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as const },
    },
} as const

function hasWinner(match: ResolvedMatch) {
    return match.a.state === 'winner' || match.b.state === 'winner'
}

type ConnectorSpec = { id: string; path: string; active: boolean }

function buildConnectors(resolved: ResolvedBracket): ConnectorSpec[] {
    return [
        { id: 'qf1-sf1', path: elbowConnectorPath(QF_RECTS[0], SF_RECTS[0].a, 'right'), active: hasWinner(resolved.qf[0]) },
        { id: 'qf2-sf1', path: elbowConnectorPath(QF_RECTS[1], SF_RECTS[0].b, 'right'), active: hasWinner(resolved.qf[1]) },
        { id: 'qf3-sf2', path: elbowConnectorPath(QF_RECTS[2], SF_RECTS[1].a, 'left'), active: hasWinner(resolved.qf[2]) },
        { id: 'qf4-sf2', path: elbowConnectorPath(QF_RECTS[3], SF_RECTS[1].b, 'left'), active: hasWinner(resolved.qf[3]) },
        { id: 'sf1-final', path: elbowConnectorPath(SF_RECTS[0], FINAL_RECTS.a, 'right'), active: hasWinner(resolved.sf[0]) },
        { id: 'sf2-final', path: elbowConnectorPath(SF_RECTS[1], FINAL_RECTS.b, 'left'), active: hasWinner(resolved.sf[1]) },
        { id: 'final-champion', path: championConnectorPath(FINAL_RECTS, CHAMPION_RECT), active: hasWinner(resolved.final) },
    ]
}

/** Absolutely positioned SVG overlay drawing the bracket's elbow connector lines. */
export function Connectors({ resolved, animate }: { resolved: ResolvedBracket; animate: 'visible' | 'hidden' }) {
    const connectors = buildConnectors(resolved)

    return (
        <svg
            width={GRAPHIC_WIDTH}
            height={GRAPHIC_HEIGHT}
            style={{ position: 'absolute', top: 0, left: 0, zIndex: 2, pointerEvents: 'none' }}
        >
            {connectors.map((connector) => (
                <motion.path
                    key={connector.id}
                    d={connector.path}
                    fill="none"
                    stroke={connector.active ? GOLD : DIM_STROKE}
                    strokeWidth={connector.active ? 3 : 2}
                    strokeLinecap="square"
                    strokeLinejoin="miter"
                    initial="hidden"
                    animate={animate}
                    variants={pathVariants}
                    style={{
                        filter: connector.active ? 'drop-shadow(0 0 6px rgba(255, 198, 0, 0.6))' : undefined,
                        transition: 'stroke 0.35s ease, stroke-width 0.35s ease, filter 0.35s ease',
                    }}
                />
            ))}
        </svg>
    )
}
