import { basketballScorebugDefaultProps, type BasketballScorebugProps } from './-types'
import { Button, FieldRow, Select } from '@gurleen-ui/core'
import type { CSSProperties } from 'react'

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

export function PreviewToolbarControls({
  state,
  clockRunning,
  onClockRunningChange,
  onStateChange,
}: {
  state: BasketballScorebugProps
  clockRunning: boolean
  onClockRunningChange: (running: boolean) => void
  onStateChange: (
    patch: Partial<BasketballScorebugProps> | ((prev: BasketballScorebugProps) => BasketballScorebugProps),
  ) => void
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
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
        maxWidth: 'min(100vw, 72rem)',
      }}
    >
      <ScoreStepper
        label="Away"
        value={state.away.score}
        onDelta={(delta) => bumpScore('away', delta)}
      />
      <ScoreStepper
        label="Home"
        value={state.home.score}
        onDelta={(delta) => bumpScore('home', delta)}
      />
      <FieldRow label="Period">
        <Select
          value={state.period}
          options={[...PERIOD_OPTIONS]}
          onChange={(value: string) => onStateChange({ period: value })}
          width={100}
        />
      </FieldRow>
      <FieldRow label="Clock">
        <div style={rowCluster}>
          <span style={{ ...readout, minWidth: '3.5rem' }}>{state.clock}</span>
          <Button
            label={clockRunning ? 'Stop' : 'Start'}
            size="sm"
            variant={clockRunning ? 'armed' : 'default'}
            active={clockRunning}
            onClick={() => onClockRunningChange(!clockRunning)}
          />
          <Button
            label="Reset"
            size="sm"
            onClick={() => {
              onClockRunningChange(false)
              onStateChange({ clock: basketballScorebugDefaultProps.clock })
            }}
          />
        </div>
      </FieldRow>
      <FieldRow label="Shot">
        <div style={rowCluster}>
          <Button label="−" size="sm" onClick={() => bumpShotClock(-1)} />
          <span style={readout}>{state.shotClock}</span>
          <Button label="+" size="sm" onClick={() => bumpShotClock(1)} />
          <Button
            label="Reset"
            size="sm"
            onClick={() => onStateChange({ shotClock: basketballScorebugDefaultProps.shotClock })}
          />
        </div>
      </FieldRow>
    </div>
  )
}
