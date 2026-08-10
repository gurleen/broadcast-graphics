import { Button } from '@gurleen-ui/core'

export function PreviewTransport({
  onIn,
  onOut,
  onReset,
}: {
  onIn: () => void
  onOut: () => void
  onReset?: () => void
}) {
  return (
    <>
      <Button label="In" variant="accent" size="md" onClick={onIn} />
      <Button label="Out" size="md" onClick={onOut} />
      {onReset ? <Button label="Reset" size="md" onClick={onReset} /> : null}
    </>
  )
}
