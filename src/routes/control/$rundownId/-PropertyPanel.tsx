import { useEffect, useMemo, useState } from 'react'
import { Checkbox, FieldRow, Input, Select, Slider, Switch } from '@gurleen-ui/core'
import type { GraphicInstance } from '#/control/model'
import type { TemplatePublicMeta } from '#/templates/schemas'
import { resolveTemplateDefinition } from '#/templates/registry'
import { useTemplateCatalog } from '#/control/client'
import { useTemplateComponents } from '#/packages/hooks'
import type { FieldDef, FieldDefType } from '#/templates/types'

type PropertyPanelProps = {
  instance: GraphicInstance | null
  template: TemplatePublicMeta | undefined
  /** True when the catalog has loaded and this instance's templateId is absent. */
  templateMissing?: boolean
  onPatch: (patch: Record<string, unknown>) => void
  onReplace: (props: Record<string, unknown>) => void
}

type PanelField = {
  key: string
  label: string
  type: FieldDefType
  value: unknown
  options?: FieldDef['options']
  caption?: string
  labels?: [string, string]
  unit?: string
  align?: 'left' | 'right'
  min?: number
  max?: number
  step?: number
  readonly?: boolean
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
  if (previous != null && typeof previous === 'object') {
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw)
      } catch {
        return previous
      }
    }
  }
  return raw
}

function mergePatch(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      base[key] &&
      typeof base[key] === 'object' &&
      !Array.isArray(base[key])
    ) {
      next[key] = {
        ...(base[key] as Record<string, unknown>),
        ...(value as Record<string, unknown>),
      }
    } else {
      next[key] = value
    }
  }
  return next
}

function ReadonlyValue({ value }: { value: unknown }) {
  return (
    <span
      style={{
        display: 'block',
        width: '100%',
        minWidth: 0,
        fontSize: 11,
        color: 'var(--fg-3)',
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
        whiteSpace: 'pre-wrap',
        lineHeight: 1.35,
      }}
    >
      {formatValue(value)}
    </span>
  )
}

function MetaSection({ instance }: { instance: GraphicInstance }) {
  const fields: PanelField[] = [
    { key: '_template', label: 'Template', type: 'readonly', value: instance.templateId, readonly: true },
    { key: '_label', label: 'Label', type: 'readonly', value: instance.label, readonly: true },
    { key: '_revision', label: 'Revision', type: 'readonly', value: String(instance.revision), readonly: true },
    { key: '_layer', label: 'Layer', type: 'readonly', value: String(instance.layer), readonly: true },
  ]

  return (
    <div style={{ minWidth: 0 }}>
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
        META
      </div>
      {fields.map((f) => (
        <FieldRow
          key={f.key}
          label={f.label}
          style={{ alignItems: 'start', minWidth: 0 }}
        >
          <ReadonlyValue value={f.value} />
        </FieldRow>
      ))}
    </div>
  )
}

export function PropertyPanel({
  instance,
  template,
  templateMissing = false,
  onPatch,
  onReplace,
}: PropertyPanelProps) {
  const { packages } = useTemplateCatalog()
  useTemplateComponents(instance ? [instance.templateId] : [], packages)
  const Controls = instance
    ? resolveTemplateDefinition(instance.templateId)?.Controls
    : undefined

  // Local draft so typing isn't reset when parent re-renders with stale server props.
  // Reset synchronously on instance switch so Controls never see another template's shape.
  const [draft, setDraft] = useState<{
    instanceId: string | null
    props: Record<string, unknown>
  }>(() => ({
    instanceId: instance?.id ?? null,
    props: instance?.props ?? {},
  }))

  if (instance && draft.instanceId !== instance.id) {
    setDraft({ instanceId: instance.id, props: instance.props })
  } else if (!instance && draft.instanceId != null) {
    setDraft({ instanceId: null, props: {} })
  }

  useEffect(() => {
    if (!instance) {
      setDraft({ instanceId: null, props: {} })
      return
    }
    setDraft({ instanceId: instance.id, props: instance.props })
  }, [instance?.id, instance?.revision])

  const draftProps = draft.props

  const applyPatch = (patch: Record<string, unknown>) => {
    setDraft((prev) => ({
      ...prev,
      props: mergePatch(prev.props, patch),
    }))
    onPatch(patch)
  }

  const applyReplace = (props: Record<string, unknown>) => {
    setDraft((prev) => ({
      ...prev,
      props,
    }))
    onReplace(props)
  }

  const sections = useMemo(() => {
    if (!instance || Controls) return [] as { title: string; fields: PanelField[] }[]

    const fieldsBySection = new Map<string, PanelField[]>()
    const covered = new Set<string>()
    const fieldDefs = (template?.fields ?? {}) as Record<string, FieldDef | undefined>

    for (const [key, def] of Object.entries(fieldDefs)) {
      if (!def) continue
      covered.add(key)
      const section = def.section ?? 'TEMPLATE DATA'
      const list = fieldsBySection.get(section) ?? []
      list.push({
        key,
        label: def.label,
        type: def.type ?? 'text',
        value: draftProps[key],
        options: def.options,
        caption: def.caption,
        labels: def.labels,
        unit: def.unit,
        align: def.align,
        min: def.min,
        max: def.max,
        step: def.step,
      })
      fieldsBySection.set(section, list)
    }

    const extras: PanelField[] = []
    for (const [key, value] of Object.entries(draftProps)) {
      if (covered.has(key)) continue
      extras.push({
        key,
        label: key,
        type: typeof value === 'boolean' ? 'checkbox' : 'text',
        value,
        caption: typeof value === 'boolean' ? key : undefined,
      })
    }
    if (extras.length > 0) {
      fieldsBySection.set('PROPS', [...(fieldsBySection.get('PROPS') ?? []), ...extras])
    }

    return [...fieldsBySection.entries()].map(([title, fields]) => ({ title, fields }))
  }, [instance, template, Controls, draftProps])

  if (!instance) {
    return (
      <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>
        Select a rundown item to edit its template properties.
      </span>
    )
  }

  if (!template) {
    if (!templateMissing) {
      return (
        <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>Loading template catalog…</span>
      )
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
        <div
          role="alert"
          style={{
            padding: '8px 10px',
            border: '1px solid var(--warn)',
            background: 'var(--warn-bg, color-mix(in srgb, var(--warn) 12%, transparent))',
            fontSize: 11,
            lineHeight: 1.4,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4, letterSpacing: '0.06em' }}>
            TEMPLATE NOT FOUND
          </div>
          <div style={{ color: 'var(--fg-2)' }}>
            This item uses <code>{instance.templateId}</code>, which is not in the current
            catalog. Reinstall the package that provides it, or remove this item from the
            rundown.
          </div>
        </div>
        <MetaSection instance={instance} />
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-mono)',
        minWidth: 0,
        maxWidth: '100%',
        overflow: 'hidden',
        gap: 8,
      }}
    >
      {Controls && instance && draft.instanceId === instance.id ? (
        <Controls
          props={draftProps}
          patch={(patch) => applyPatch(patch as Record<string, unknown>)}
          replace={(next) => applyReplace(next as Record<string, unknown>)}
          onScreen={instance.playout.onScreen}
          setOnScreen={() => {}}
        />
      ) : (
        sections.map((sec) => (
          <div key={sec.title} style={{ minWidth: 0 }}>
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
              {sec.title}
            </div>
            {sec.fields.map((f) => {
              const fire = (raw: unknown) => {
                if (f.readonly || f.key.startsWith('_')) return
                applyPatch({ [f.key]: parseValue(raw, f.value) })
              }

              let ctl
              if (f.type === 'select') {
                ctl = (
                  <Select
                    options={f.options}
                    value={formatValue(f.value)}
                    width="100%"
                    onChange={(v) => fire(v)}
                  />
                )
              } else if (f.type === 'checkbox') {
                ctl = (
                  <Checkbox
                    checked={Boolean(f.value)}
                    label={f.caption}
                    onChange={(v) => fire(v)}
                  />
                )
              } else if (f.type === 'switch') {
                ctl = (
                  <Switch
                    checked={Boolean(f.value)}
                    labels={f.labels}
                    onChange={(v) => fire(v)}
                  />
                )
              } else if (f.type === 'slider') {
                const numeric =
                  typeof f.value === 'number' ? f.value : Number(f.value)
                ctl = (
                  <Slider
                    value={Number.isFinite(numeric) ? numeric : (f.min ?? 0)}
                    min={f.min ?? 0}
                    max={f.max ?? 100}
                    step={f.step ?? 1}
                    unit={f.unit ?? ''}
                    width="100%"
                    onChange={(v) => fire(v)}
                  />
                )
              } else if (f.type === 'readonly' || f.readonly) {
                ctl = <ReadonlyValue value={f.value} />
              } else {
                ctl = (
                  <Input
                    value={formatValue(f.value)}
                    unit={f.unit}
                    width="100%"
                    align={f.align}
                    onChange={(v) => fire(v)}
                    style={{ overflowWrap: 'anywhere' }}
                  />
                )
              }

              return (
                <FieldRow
                  key={f.key}
                  label={f.label}
                  style={{
                    alignItems: f.type === 'readonly' || f.readonly ? 'start' : 'center',
                    minWidth: 0,
                  }}
                >
                  {ctl}
                </FieldRow>
              )
            })}
          </div>
        ))
      )}

      <MetaSection instance={instance} />
    </div>
  )
}
