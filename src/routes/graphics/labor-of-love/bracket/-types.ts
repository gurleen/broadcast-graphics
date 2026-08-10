export type LaborOfLoveTeam = {
    id: string
    name: string
    wrestlers: [string, string]
}

/** `'a'` picks the first team of the match, `'b'` the second, `null` = undecided. */
export type MatchWinner = 'a' | 'b' | null

export type LaborOfLoveBracketWinners = {
    /** Quarterfinal winners, in bracket order: [QF1, QF2, QF3, QF4]. */
    qf: [MatchWinner, MatchWinner, MatchWinner, MatchWinner]
    /** Semifinal winners, in bracket order: [SF1 (left), SF2 (right)]. */
    sf: [MatchWinner, MatchWinner]
    final: MatchWinner
}

export type LaborOfLoveBracketProps = {
    eventName: string
    bracketName: string
    /** 8 teams in seed order: [QF1a, QF1b, QF2a, QF2b, QF3a, QF3b, QF4a, QF4b]. */
    teams: [
        LaborOfLoveTeam,
        LaborOfLoveTeam,
        LaborOfLoveTeam,
        LaborOfLoveTeam,
        LaborOfLoveTeam,
        LaborOfLoveTeam,
        LaborOfLoveTeam,
        LaborOfLoveTeam,
    ]
    winners: LaborOfLoveBracketWinners
}

export type SlotState = 'pending' | 'undecided' | 'winner' | 'loser'

export type MatchSlot = {
    team: LaborOfLoveTeam | null
    state: SlotState
}

export type ResolvedMatch = {
    a: MatchSlot
    b: MatchSlot
}

export type ResolvedBracket = {
    qf: [ResolvedMatch, ResolvedMatch, ResolvedMatch, ResolvedMatch]
    sf: [ResolvedMatch, ResolvedMatch]
    final: ResolvedMatch
    champion: LaborOfLoveTeam | null
}

function slotState(hasTeam: boolean, winner: MatchWinner, side: 'a' | 'b'): SlotState {
    if (!hasTeam) return 'pending'
    if (winner == null) return 'undecided'
    return winner === side ? 'winner' : 'loser'
}

function resolveMatch(teamA: LaborOfLoveTeam | null, teamB: LaborOfLoveTeam | null, winner: MatchWinner): ResolvedMatch {
    return {
        a: { team: teamA, state: slotState(teamA != null, winner, 'a') },
        b: { team: teamB, state: slotState(teamB != null, winner, 'b') },
    }
}

function matchWinnerTeam(match: ResolvedMatch): LaborOfLoveTeam | null {
    if (match.a.state === 'winner') return match.a.team
    if (match.b.state === 'winner') return match.b.team
    return null
}

/**
 * Derives every match slot (and the champion) from `teams` + `winners`.
 * Semifinal and final slots fall out of quarterfinal/semifinal winners, so the
 * preview controls only ever need to set `winners` and everything else follows.
 */
export function resolveBracket({ teams, winners }: LaborOfLoveBracketProps): ResolvedBracket {
    const qf: ResolvedBracket['qf'] = [
        resolveMatch(teams[0], teams[1], winners.qf[0]),
        resolveMatch(teams[2], teams[3], winners.qf[1]),
        resolveMatch(teams[4], teams[5], winners.qf[2]),
        resolveMatch(teams[6], teams[7], winners.qf[3]),
    ]

    const sf: ResolvedBracket['sf'] = [
        resolveMatch(matchWinnerTeam(qf[0]), matchWinnerTeam(qf[1]), winners.sf[0]),
        resolveMatch(matchWinnerTeam(qf[2]), matchWinnerTeam(qf[3]), winners.sf[1]),
    ]

    const final = resolveMatch(matchWinnerTeam(sf[0]), matchWinnerTeam(sf[1]), winners.final)
    const champion = matchWinnerTeam(final)

    return { qf, sf, final, champion }
}

/**
 * Sets a single match's winner and clears any downstream winners that were
 * derived from it, so the bracket can never point at a team that's no longer there.
 */
export function setMatchWinner(
    winners: LaborOfLoveBracketWinners,
    round: 'qf' | 'sf' | 'final',
    index: number,
    winner: MatchWinner,
): LaborOfLoveBracketWinners {
    if (round === 'final') {
        return { ...winners, final: winner }
    }

    if (round === 'sf') {
        const sf = [...winners.sf] as LaborOfLoveBracketWinners['sf']
        sf[index] = winner
        return { ...winners, sf, final: null }
    }

    const qf = [...winners.qf] as LaborOfLoveBracketWinners['qf']
    qf[index] = winner
    const sfIndex = index < 2 ? 0 : 1
    const sf = [...winners.sf] as LaborOfLoveBracketWinners['sf']
    sf[sfIndex] = null
    return { ...winners, qf, sf, final: null }
}

function team(id: string, name: string, wrestlers: [string, string]): LaborOfLoveTeam {
    return { id, name, wrestlers }
}

export const laborOfLoveBracketProps: LaborOfLoveBracketProps = {
    eventName: 'LABOR OF LOVE',
    bracketName: 'COMMONWEALTH CUP',
    teams: [
        team('butcher-and-blade', 'THE BUTCHER AND THE BLADE', ['The Butcher', 'The Blade']),
        team('citywide-street-gang', 'CITYWIDE STREET GANG', ['Tom LaRosa', 'Martin Hughes']),
        team('bang-and-matthews', 'BANG AND MATTHEWS', ['Davey Bang', 'August Matthews']),
        team('killer-goat', 'KILLER GOAT', ['Killer Kelly', 'Myron Reed']),
        team('bestbros', 'BESTBROS', ['Baliyan Akki', 'Mei Suruga']),
        team('dolphin-funeral', 'DOLPHIN FUNERAL', ['Julezee', 'RULLO']),
        team('the-outfielders', 'THE OUTFIELDERS', ['Weber Hatfield', 'Shea McCoy']),
        team('wilde-llc', 'WILDE LLC', ['Ethan Wilde', 'Dylan Mesh']),
    ],
    winners: {
        // All quarterfinals + both semifinals decided, final still open — so the
        // default preview shows winners/losers through the bracket and a TBD champion.
        qf: [null, null, null, null],
        sf: [null, null],
        final: null,
    },
}
