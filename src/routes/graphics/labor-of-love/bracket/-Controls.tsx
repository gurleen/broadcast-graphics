import { useMemo, type CSSProperties } from 'react'
import { Button, FieldRow, Input, Panel } from '@hydra-tv/ui'
import type { TemplateControlsProps } from '#/templates/types'
import {
  resolveBracket,
  setMatchWinner,
  type LaborOfLoveBracketProps,
  type MatchWinner,
  type ResolvedMatch,
} from './-types'

const rowCluster: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 6,
}

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
    <FieldRow label={label}>
      <div style={rowCluster}>
        <Button
          label={sideLabel('a')}
          size="sm"
          variant={winner === 'a' ? 'accent' : 'default'}
          active={winner === 'a'}
          disabled={!match.a.team}
          onClick={() => onPick('a')}
        />
        <Button
          label={sideLabel('b')}
          size="sm"
          variant={winner === 'b' ? 'accent' : 'default'}
          active={winner === 'b'}
          disabled={!match.b.team}
          onClick={() => onPick('b')}
        />
        <Button label="Clear" size="sm" onClick={() => onPick(null)} />
      </div>
    </FieldRow>
  )
}

export function LaborOfLoveBracketControls({
  props,
  patch,
  replace,
}: TemplateControlsProps<LaborOfLoveBracketProps>) {
  const resolved = useMemo(() => {
    if (!props?.teams || !props?.winners?.qf || !props.winners.sf) return null
    return resolveBracket(props)
  }, [props])

  if (!resolved) {
    return (
      <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>Loading bracket…</span>
    )
  }

  const setWinner = (round: 'qf' | 'sf' | 'final', index: number, winner: MatchWinner) => {
    replace({
      ...props,
      winners: setMatchWinner(props.winners, round, index, winner),
    })
  }

  return (
    <Panel title="Bracket preview">
      <FieldRow label="Event">
        <Input
          value={props.eventName}
          onChange={(value: string) => patch({ eventName: value })}
          width={200}
        />
      </FieldRow>
      <FieldRow label="Bracket">
        <Input
          value={props.bracketName}
          onChange={(value: string) => patch({ bracketName: value })}
          width={200}
        />
      </FieldRow>
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
        label="Final"
        match={resolved.final}
        winner={props.winners.final}
        onPick={(winner) => setWinner('final', 0, winner)}
      />
    </Panel>
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
