import type { CSSProperties } from 'react'
import { Button, FieldRow, Input, Select } from '@gurleen-ui/core'
import type { TemplateControlsProps } from '#/templates/types'
import {
  basketballScorebugDefaultProps,
  type BasketballScorebugProps,
} from './-types'

export const PERIOD_OPTIONS = ['1ST', '2ND', 'HALF', '3RD', '4TH', 'OT', '2OT'] as const

const rowCluster: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 6,
}

const readout: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  color: 'var(--fg-1)',
  minWidth: '2ch',
  textAlign: 'center',
  fontVariantNumeric: 'tabular-nums',
}

function numericScore(score: number | string): number {
  const value = typeof score === 'number' ? score : Number.parseInt(score, 10)
  return Number.isFinite(value) ? value : 0
}

function ScoreStepper({
  label,
  value,
  onDelta,
}: {
  label: string
  value: number | string
  onDelta: (delta: number) => void
}) {
  return (
    <FieldRow label={label}>
      <div style={rowCluster}>
        <Button label="−" size="sm" onClick={() => onDelta(-1)} />
        <span style={readout}>{value}</span>
        <Button label="+" size="sm" onClick={() => onDelta(1)} />
      </div>
    </FieldRow>
  )
}

export function BasketballScorebugControls({
  props,
  patch,
  replace,
}: TemplateControlsProps<BasketballScorebugProps>) {
  const bumpScore = (side: 'home' | 'away', delta: number) => {
    replace({
      ...props,
      [side]: {
        ...props[side],
        score: Math.max(0, numericScore(props[side].score) + delta),
      },
    })
  }

  const bumpShotClock = (delta: number) => {
    patch({
      shotClock: Math.max(0, numericScore(props.shotClock) + delta),
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <ScoreStepper
        label="Away"
        value={props.away.score}
        onDelta={(delta) => bumpScore('away', delta)}
      />
      <ScoreStepper
        label="Home"
        value={props.home.score}
        onDelta={(delta) => bumpScore('home', delta)}
      />
      <FieldRow label="Away code">
        <Input
          value={props.away.teamCode}
          width="100%"
          onChange={(value) =>
            replace({
              ...props,
              away: { ...props.away, teamCode: value },
            })
          }
        />
      </FieldRow>
      <FieldRow label="Home code">
        <Input
          value={props.home.teamCode}
          width="100%"
          onChange={(value) =>
            replace({
              ...props,
              home: { ...props.home, teamCode: value },
            })
          }
        />
      </FieldRow>
      <FieldRow label="Period">
        <Select
          value={props.period}
          options={[...PERIOD_OPTIONS]}
          width="100%"
          onChange={(value) => patch({ period: value })}
        />
      </FieldRow>
      <FieldRow label="Clock">
        <div style={rowCluster}>
          <Input
            value={props.clock}
            width={80}
            onChange={(value) => patch({ clock: value })}
          />
          <Button
            label="Reset"
            size="sm"
            onClick={() => patch({ clock: basketballScorebugDefaultProps.clock })}
          />
        </div>
      </FieldRow>
      <FieldRow label="Shot">
        <div style={rowCluster}>
          <Button label="−" size="sm" onClick={() => bumpShotClock(-1)} />
          <span style={readout}>{props.shotClock}</span>
          <Button label="+" size="sm" onClick={() => bumpShotClock(1)} />
          <Button
            label="Reset"
            size="sm"
            onClick={() => patch({ shotClock: basketballScorebugDefaultProps.shotClock })}
          />
        </div>
      </FieldRow>
    </div>
  )
}
