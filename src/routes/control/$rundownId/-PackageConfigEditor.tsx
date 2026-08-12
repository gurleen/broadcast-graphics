import { Checkbox, FieldRow, Input, Select, Slider, Switch } from '@hydra-tv/ui'
import type { PackagePublicMeta } from '#/templates/schemas'
import type { FieldDef, FieldDefType } from '#/templates/types'

type ConfigField = {
  key: string
  label: string
  type: FieldDefType
  value: unknown
  options?: FieldDef['options']
  unit?: string
  min?: number
  max?: number
  step?: number
}

function formatValue(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function parseValue(raw: unknown, previous: unknown): unknown {
  if (typeof previous === 'boolean') return Boolean(raw)
  if (typeof previous === 'number') {
    const n = Number(raw)
    return Number.isFinite(n) ? n : previous
  }
  return raw
}

/**
 * Generic package-config form driven by the package's declared `config.fields`
 * (falling back to a plain key/value editor for undeclared keys). This is the
 * concrete "tab panel for package config" the SDK's `panels` extension point
 * will eventually let a package replace with custom UI.
 */
export function PackageConfigEditor({
  pkg,
  config,
  onPatch,
}: {
  pkg: PackagePublicMeta
  config: Record<string, unknown>
  onPatch: (patch: Record<string, unknown>) => void
}) {
  const defs = pkg.config?.fields ?? {}
  const defaults = pkg.config?.defaults ?? {}
  const keys = new Set([...Object.keys(defs), ...Object.keys(defaults), ...Object.keys(config)])

  const fields: ConfigField[] = [...keys].map((key) => {
    const def = defs[key]
    const value = key in config ? config[key] : defaults[key]
    return {
      key,
      label: def?.label ?? key,
      type: def?.type ?? (typeof value === 'boolean' ? 'checkbox' : 'text'),
      value,
      options: def?.options,
      unit: def?.unit,
      min: def?.min,
      max: def?.max,
      step: def?.step,
    }
  })

  if (fields.length === 0) {
    return <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>This package has no declared config.</span>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      {fields.map((f) => {
        const fire = (raw: unknown) => onPatch({ [f.key]: parseValue(raw, f.value) })

        let ctl
        if (f.type === 'select') {
          ctl = <Select options={f.options} value={formatValue(f.value)} width="100%" onChange={fire} />
        } else if (f.type === 'checkbox') {
          ctl = <Checkbox checked={Boolean(f.value)} onChange={fire} />
        } else if (f.type === 'switch') {
          ctl = <Switch checked={Boolean(f.value)} onChange={fire} />
        } else if (f.type === 'slider') {
          const numeric = typeof f.value === 'number' ? f.value : Number(f.value)
          ctl = (
            <Slider
              value={Number.isFinite(numeric) ? numeric : (f.min ?? 0)}
              min={f.min ?? 0}
              max={f.max ?? 100}
              step={f.step ?? 1}
              unit={f.unit ?? ''}
              width="100%"
              onChange={fire}
            />
          )
        } else if (f.type === 'number') {
          ctl = <Input value={formatValue(f.value)} unit={f.unit} width="100%" onChange={fire} />
        } else {
          ctl = <Input value={formatValue(f.value)} unit={f.unit} width="100%" onChange={fire} />
        }

        return (
          <FieldRow key={f.key} label={f.label} style={{ alignItems: 'center', minWidth: 0 }}>
            {ctl}
          </FieldRow>
        )
      })}
    </div>
  )
}
