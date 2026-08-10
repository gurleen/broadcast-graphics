import { GRAPHIC_WIDTH } from '#/graphics/constants'

export type Rect = { x: number; y: number; width: number; height: number }
export type MatchRects = { a: Rect; b: Rect }

export const CARD_WIDTH = 300
export const CARD_HEIGHT = 92
/** Vertical gap between the two cards of a quarterfinal/semifinal match. */
export const CARD_GAP = 14
/** Wider vertical gap between the two finalist cards, to make room for the "VS" mark. */
export const FINAL_GAP = 140

export const QF_LEFT_X = 40
export const QF_RIGHT_X = GRAPHIC_WIDTH - QF_LEFT_X - CARD_WIDTH
/** Leave a real corridor between QF and SF so elbow runs have length. */
export const SF_LEFT_X = 430
export const SF_RIGHT_X = GRAPHIC_WIDTH - SF_LEFT_X - CARD_WIDTH
export const FINAL_X = (GRAPHIC_WIDTH - CARD_WIDTH) / 2

export const QF_TOP_CENTER_Y = 300
export const QF_BOTTOM_CENTER_Y = 760
export const SF_CENTER_Y = (QF_TOP_CENTER_Y + QF_BOTTOM_CENTER_Y) / 2
export const FINAL_CENTER_Y = SF_CENTER_Y

export const CHAMPION_WIDTH = 520
export const CHAMPION_HEIGHT = 150
export const CHAMPION_CENTER_Y = 790
export const CHAMPION_X = (GRAPHIC_WIDTH - CHAMPION_WIDTH) / 2
export const CHAMPION_TOP_Y = CHAMPION_CENTER_Y - CHAMPION_HEIGHT / 2

export const ROUND_LABEL_Y = 168

/** Builds the stacked `{ a, b }` card rects for a match centered at `(x, centerY)`. */
function matchRects(x: number, centerY: number, gap: number): MatchRects {
    const blockHeight = CARD_HEIGHT * 2 + gap
    const top = centerY - blockHeight / 2
    return {
        a: { x, y: top, width: CARD_WIDTH, height: CARD_HEIGHT },
        b: { x, y: top + CARD_HEIGHT + gap, width: CARD_WIDTH, height: CARD_HEIGHT },
    }
}

/** Card rects for the 4 quarterfinal matches, in bracket order [QF1, QF2, QF3, QF4]. */
export const QF_RECTS: [MatchRects, MatchRects, MatchRects, MatchRects] = [
    matchRects(QF_LEFT_X, QF_TOP_CENTER_Y, CARD_GAP),
    matchRects(QF_LEFT_X, QF_BOTTOM_CENTER_Y, CARD_GAP),
    matchRects(QF_RIGHT_X, QF_TOP_CENTER_Y, CARD_GAP),
    matchRects(QF_RIGHT_X, QF_BOTTOM_CENTER_Y, CARD_GAP),
]

/** Card rects for the 2 semifinal matches, in bracket order [SF1 (left), SF2 (right)]. */
export const SF_RECTS: [MatchRects, MatchRects] = [
    matchRects(SF_LEFT_X, SF_CENTER_Y, CARD_GAP),
    matchRects(SF_RIGHT_X, SF_CENTER_Y, CARD_GAP),
]

/** Card rects for the final. */
export const FINAL_RECTS: MatchRects = matchRects(FINAL_X, FINAL_CENTER_Y, FINAL_GAP)

export const CHAMPION_RECT: Rect = {
    x: CHAMPION_X,
    y: CHAMPION_TOP_Y,
    width: CHAMPION_WIDTH,
    height: CHAMPION_HEIGHT,
}

function rectCenterY(rect: Rect) {
    return rect.y + rect.height / 2
}

/**
 * Classic bracket elbow: stubs out of both cards, a vertical join, then an
 * arm from the join midpoint into the target card (extending vertically when
 * the target isn't centered on the match).
 * `direction: 'right'` draws left-to-right (left-side rounds); `'left'` mirrors it.
 */
export function elbowConnectorPath(match: MatchRects, target: Rect, direction: 'right' | 'left'): string {
    const startX = direction === 'right' ? match.a.x + match.a.width : match.a.x
    const targetX = direction === 'right' ? target.x : target.x + target.width
    // Sit the vertical bar mid-corridor so both the stubs and the run-out have length.
    const barX = startX + (targetX - startX) * 0.55

    const aY = rectCenterY(match.a)
    const bY = rectCenterY(match.b)
    const midY = (aY + bY) / 2
    const targetY = rectCenterY(target)

    return [
        // Bracket join: out from A, down/up to B, back into B (one continuous stroke).
        `M ${startX} ${aY}`,
        `H ${barX}`,
        `V ${bY}`,
        `H ${startX}`,
        // Arm from join midpoint into the next-round slot.
        `M ${barX} ${midY}`,
        `V ${targetY}`,
        `H ${targetX}`,
    ].join(' ')
}

/** Stem from below the finalists down into the champion plate. */
export function championConnectorPath(final: MatchRects, champion: Rect): string {
    const centerX = final.a.x + final.a.width / 2
    const startY = final.b.y + final.b.height
    return `M ${centerX} ${startY} V ${champion.y}`
}
