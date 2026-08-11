import { Button, FieldRow } from '@gurleen-ui/core'
import type { CSSProperties } from 'react'
import { BasketballScorebugControls } from './-Controls'
import { basketballScorebugDefaultProps, type BasketballScorebugProps } from './-types'

export { PERIOD_OPTIONS } from './-Controls'

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
  minWidth: '3.5rem',
  textAlign: 'center',
  fontVariantNumeric: 'tabular-nums',
}

/**
 * Preview toolbar wrapper: shared Controls plus local clock start/stop.
 */
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
  const patch = (next: Partial<BasketballScorebugProps>) => onStateChange(next)
  const replace = (next: BasketballScorebugProps) => onStateChange(() => next)

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        gap: 8,
        maxWidth: 'min(100vw, 72rem)',
      }}
    >
      <BasketballScorebugControls
        props={state}
        patch={patch}
        replace={replace}
        onScreen={false}
        setOnScreen={() => {}}
      />
      <FieldRow label="Run clock" divided={false}>
        <div style={rowCluster}>
          <span style={readout}>{state.clock}</span>
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
    </div>
  )
}
