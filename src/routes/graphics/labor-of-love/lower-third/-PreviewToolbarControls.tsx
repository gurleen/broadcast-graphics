import { FieldRow, Input } from '@gurleen-ui/core'
import type { LaborOfLoveLowerThirdProps } from './-types'

export function PreviewToolbarControls({
  workerName,
  championshipName,
  onChange,
}: {
  workerName: string
  championshipName: string
  onChange: (patch: Partial<LaborOfLoveLowerThirdProps>) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <FieldRow label="Worker">
        <Input
          value={workerName}
          onChange={(value: string) => onChange({ workerName: value })}
          width={220}
        />
      </FieldRow>
      <FieldRow label="Championship">
        <Input
          value={championshipName}
          onChange={(value: string) => onChange({ championshipName: value })}
          width={220}
        />
      </FieldRow>
    </div>
  )
}
