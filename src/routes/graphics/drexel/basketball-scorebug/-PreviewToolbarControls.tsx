import { BasketballScorebugControls } from './-Controls'
import type { BasketballScorebugProps } from './-types'

export { PERIOD_OPTIONS } from './-Controls'

/**
 * Preview toolbar wrapper: shared Controls (including Start/Stop via the Drexel clock store).
 */
export function PreviewToolbarControls({
  state,
  onStateChange,
}: {
  state: BasketballScorebugProps
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
    </div>
  )
}
