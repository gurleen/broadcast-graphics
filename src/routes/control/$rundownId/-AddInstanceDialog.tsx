import { useEffect, useState } from 'react'
import { Dialog, Input, Select } from '@gurleen-ui/core'
import type { TemplatePublicMeta } from '#/templates/schemas'

type AddInstanceDialogProps = {
  open: boolean
  templates: TemplatePublicMeta[]
  initialTemplateId?: string
  onClose: () => void
  onAdd: (input: { templateId: string; label?: string }) => Promise<boolean>
}

export function AddInstanceDialog({
  open,
  templates,
  initialTemplateId,
  onClose,
  onAdd,
}: AddInstanceDialogProps) {
  const [templateId, setTemplateId] = useState(initialTemplateId ?? templates[0]?.id ?? '')
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setTemplateId(initialTemplateId ?? templates[0]?.id ?? '')
    setLabel('')
    setBusy(false)
  }, [open, initialTemplateId, templates])

  const submit = async () => {
    if (!templateId || busy) return
    setBusy(true)
    const ok = await onAdd({
      templateId,
      label: label.trim() || undefined,
    })
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <Dialog
      open={open}
      title="ADD INSTANCE"
      message="Add a graphic to this rundown"
      confirmLabel={busy ? 'ADDING…' : 'ADD'}
      confirmVariant="accent"
      cancelLabel="CANCEL"
      onCancel={onClose}
      onConfirm={() => void submit()}
      width={400}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
        <Select
          label="Template"
          value={templateId}
          width="100%"
          options={templates.map((t) => ({ value: t.id, label: t.name }))}
          onChange={setTemplateId}
        />
        <Input
          label="Label"
          value={label}
          onChange={setLabel}
          width="100%"
          placeholder="Optional (auto if blank)"
        />
      </div>
    </Dialog>
  )
}
