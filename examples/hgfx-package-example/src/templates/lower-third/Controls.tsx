import { FieldRow, Input } from '@gurleen-ui/core'
import type { TemplateControlsProps } from '@hydra/gfx-runtime/types'
import type { ExampleLowerThirdProps } from './schema'

export default function ExampleLowerThirdControls({
  props,
  patch,
}: TemplateControlsProps<ExampleLowerThirdProps>) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <div
        style={{
          padding: '6px 0 3px',
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--fg-3)',
          borderBottom: '1px solid var(--line-1)',
          marginBottom: 4,
        }}
      >
        EXAMPLE CONTROLS
      </div>
      <FieldRow label="Title">
        <Input
          value={props.title}
          width="100%"
          onChange={(v) => patch({ title: v })}
        />
      </FieldRow>
      <FieldRow label="Subtitle">
        <Input
          value={props.subtitle}
          width="100%"
          onChange={(v) => patch({ subtitle: v })}
        />
      </FieldRow>
      <FieldRow label="Accent">
        <Input
          value={props.accent}
          width="100%"
          onChange={(v) => patch({ accent: v })}
        />
      </FieldRow>
    </div>
  )
}
