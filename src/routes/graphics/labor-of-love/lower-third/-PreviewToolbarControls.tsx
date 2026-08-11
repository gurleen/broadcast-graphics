import { FieldRow, Input, Slider } from '@hydra-tv/ui'
import type { LaborOfLoveLowerThirdProps } from './-types'

export function PreviewToolbarControls({
  workerName,
  championshipName,
  workerNameFontSize,
  championshipNameFontSize,
  onChange,
}: {
  workerName: string
  championshipName: string
  workerNameFontSize: number
  championshipNameFontSize: number
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
      <FieldRow label="Worker" divided={false}>
        <Input
          value={workerName}
          onChange={(value: string) => onChange({ workerName: value })}
          width={220}
        />
      </FieldRow>
      <FieldRow label="Championship" divided={false}>
        <Input
          value={championshipName}
          onChange={(value: string) => onChange({ championshipName: value })}
          width={220}
        />
      </FieldRow>
      <FieldRow label="Champ size" divided={false}>
        <Slider
          value={championshipNameFontSize}
          min={24}
          max={120}
          step={1}
          unit="PX"
          width={140}
          onChange={(value) => onChange({ championshipNameFontSize: value })}
        />
      </FieldRow>
      <FieldRow label="Worker size" divided={false}>
        <Slider
          value={workerNameFontSize}
          min={48}
          max={200}
          step={1}
          unit="PX"
          width={140}
          onChange={(value) => onChange({ workerNameFontSize: value })}
        />
      </FieldRow>
    </div>
  )
}
