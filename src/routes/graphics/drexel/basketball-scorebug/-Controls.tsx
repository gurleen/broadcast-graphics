import { useEffect, useRef, type CSSProperties } from 'react'
import { Button, FieldRow, Input, Select } from '@gurleen-ui/core'
import type { TemplateControlsProps } from '#/templates/types'
import {
  numericClockValue,
  registerDrexelClockSink,
  setDrexelClockRunning,
  setDrexelClockValues,
  useDrexelClock,
} from '../store'
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
  return numericClockValue(score)
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
  const clockState = useDrexelClock()
  const patchRef = useRef(patch)
  patchRef.current = patch

  // Register patch sink so the singleton ticker pushes into instance props (PGM/PVW via WS).
  useEffect(() => {
    return registerDrexelClockSink((tick) => {
      patchRef.current({ clock: tick.clock, shotClock: tick.shotClock })
    })
  }, [])

  // Keep store aligned with props when the operator edits while stopped.
  useEffect(() => {
    if (clockState.running) return
    const shot = numericScore(props.shotClock)
    if (props.clock === clockState.clock && shot === clockState.shotClock) return
    setDrexelClockValues(props.clock, shot)
  }, [props.clock, props.shotClock, clockState.running, clockState.clock, clockState.shotClock])

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
    const next = Math.max(0, numericScore(props.shotClock) + delta)
    setDrexelClockValues(clockState.clock, next)
    patch({ shotClock: next })
  }

  const startClock = () => {
    setDrexelClockValues(props.clock, props.shotClock)
    setDrexelClockRunning(true)
  }

  const stopClock = () => {
    setDrexelClockRunning(false)
  }

  const resetClock = () => {
    setDrexelClockRunning(false)
    const clock = basketballScorebugDefaultProps.clock
    setDrexelClockValues(clock, clockState.shotClock)
    patch({ clock })
  }

  const resetShotClock = () => {
    const shotClock = numericScore(basketballScorebugDefaultProps.shotClock)
    setDrexelClockValues(clockState.clock, shotClock)
    patch({ shotClock })
  }

  const displayClock = clockState.running ? clockState.clock : props.clock
  const displayShot = clockState.running ? clockState.shotClock : props.shotClock

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
            value={displayClock}
            width={80}
            onChange={(value) => {
              setDrexelClockRunning(false)
              setDrexelClockValues(value, clockState.shotClock)
              patch({ clock: value })
            }}
          />
          <Button
            label={clockState.running ? 'Stop' : 'Start'}
            size="sm"
            variant={clockState.running ? 'armed' : 'default'}
            active={clockState.running}
            onClick={() => (clockState.running ? stopClock() : startClock())}
          />
          <Button label="Reset" size="sm" onClick={resetClock} />
        </div>
      </FieldRow>
      <FieldRow label="Shot">
        <div style={rowCluster}>
          <Button label="−" size="sm" onClick={() => bumpShotClock(-1)} />
          <span style={readout}>{displayShot}</span>
          <Button label="+" size="sm" onClick={() => bumpShotClock(1)} />
          <Button label="Reset" size="sm" onClick={resetShotClock} />
        </div>
      </FieldRow>
    </div>
  )
}
