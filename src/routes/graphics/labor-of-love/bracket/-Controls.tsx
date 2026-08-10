import { useMemo } from 'react'
import type { TemplateControlsProps } from '#/templates/types'
import {
  resolveBracket,
  setMatchWinner,
  type LaborOfLoveBracketProps,
  type MatchWinner,
  type ResolvedMatch,
} from './-types'

const btn =
  'rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs font-medium text-slate-100 hover:bg-slate-700 disabled:opacity-40'
const btnAccent = `${btn} border-sky-600 bg-sky-800 hover:bg-sky-700`
const input =
  'min-w-[8rem] rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-slate-100'

function truncate(name: string, max = 18) {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name
}

function MatchPicker({
  label,
  match,
  winner,
  onPick,
}: {
  label: string
  match: ResolvedMatch
  winner: MatchWinner
  onPick: (winner: MatchWinner) => void
}) {
  const sideLabel = (side: 'a' | 'b') => {
    const slot = side === 'a' ? match.a : match.b
    if (!slot.team) return 'TBD'
    return truncate(slot.team.name)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="w-12 shrink-0 text-slate-400">{label}</span>
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          className={winner === 'a' ? btnAccent : btn}
          disabled={!match.a.team}
          onClick={() => onPick('a')}
        >
          {sideLabel('a')}
        </button>
        <button
          type="button"
          className={winner === 'b' ? btnAccent : btn}
          disabled={!match.b.team}
          onClick={() => onPick('b')}
        >
          {sideLabel('b')}
        </button>
        <button type="button" className={btn} onClick={() => onPick(null)}>
          CLEAR
        </button>
      </div>
    </div>
  )
}

export function LaborOfLoveBracketControls({
  props,
  patch,
  replace,
}: TemplateControlsProps<LaborOfLoveBracketProps>) {
  const resolved = useMemo(() => resolveBracket(props), [props])

  const setWinner = (round: 'qf' | 'sf' | 'final', index: number, winner: MatchWinner) => {
    replace({
      ...props,
      winners: setMatchWinner(props.winners, round, index, winner),
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="w-12 shrink-0 text-slate-400">Event</span>
        <input
          className={input}
          value={props.eventName}
          onChange={(e) => patch({ eventName: e.target.value })}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="w-12 shrink-0 text-slate-400">Bracket</span>
        <input
          className={input}
          value={props.bracketName}
          onChange={(e) => patch({ bracketName: e.target.value })}
        />
      </div>
      {resolved.qf.map((match, index) => (
        <MatchPicker
          key={`qf-${index}`}
          label={`QF${index + 1}`}
          match={match}
          winner={props.winners.qf[index]}
          onPick={(winner) => setWinner('qf', index, winner)}
        />
      ))}
      {resolved.sf.map((match, index) => (
        <MatchPicker
          key={`sf-${index}`}
          label={`SF${index + 1}`}
          match={match}
          winner={props.winners.sf[index]}
          onPick={(winner) => setWinner('sf', index, winner)}
        />
      ))}
      <MatchPicker
        label="FINAL"
        match={resolved.final}
        winner={props.winners.final}
        onPick={(winner) => setWinner('final', 0, winner)}
      />
    </div>
  )
}

/** Preview toolbar wrapper sharing the same control surface. */
export function PreviewToolbarControls({
  props,
  onReplace,
}: {
  props: LaborOfLoveBracketProps
  onReplace: (next: LaborOfLoveBracketProps) => void
}) {
  return (
    <LaborOfLoveBracketControls
      props={props}
      patch={(patch) => onReplace({ ...props, ...patch })}
      replace={onReplace}
      onScreen={false}
      setOnScreen={() => {}}
    />
  )
}
