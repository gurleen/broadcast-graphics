import { useState } from 'react'
import { Dialog, Input } from '@hydra-tv/ui'
import { useNavigate } from '@tanstack/react-router'

type CreateRundownDialogProps = {
  open: boolean
  onClose: () => void
  onCreate: (name: string) => Promise<{ id: string } | null>
}

export function CreateRundownDialog({ open, onClose, onCreate }: CreateRundownDialogProps) {
  const navigate = useNavigate()
  const [name, setName] = useState('Show')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed || busy) return
    setBusy(true)
    const rundown = await onCreate(trimmed)
    setBusy(false)
    if (rundown) {
      setName('Show')
      onClose()
      void navigate({ to: '/control/$rundownId', params: { rundownId: rundown.id } })
    }
  }

  return (
    <Dialog
      open={open}
      title="NEW RUNDOWN"
      message="Create a rundown"
      detail="Named container for graphic instances and playout state."
      confirmLabel={busy ? 'CREATING…' : 'CREATE'}
      confirmVariant="accent"
      cancelLabel="CANCEL"
      onCancel={onClose}
      onConfirm={() => void submit()}
      width={360}
    >
      <div style={{ marginTop: 10 }}>
        <Input
          label="Name"
          value={name}
          onChange={setName}
          width="100%"
          placeholder="Show"
        />
      </div>
    </Dialog>
  )
}
