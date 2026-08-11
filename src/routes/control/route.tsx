import { useState } from 'react'
import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import { Badge, Button, NavBar, ToastProvider } from '@gurleen-ui/core'
import { StatusBar } from '@gurleen-ui/broadcast'
import { useRundownList } from '#/control/client'
import { CreateRundownDialog } from './-CreateRundownDialog'

export const Route = createFileRoute('/control')({
  ssr: false,
  component: ControlLayout,
})

function ControlLayout() {
  const { rundowns, loading, error, refresh, createRundown } = useRundownList()
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <ToastProvider>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          background: 'var(--bg-1)',
          color: 'var(--fg-1)',
          fontFamily: 'var(--font-mono)',
          position: 'relative',
        }}
      >
        <NavBar
          brand={
            <Link to="/control" style={{ textDecoration: 'none', color: 'inherit' }}>
              <span style={{ fontWeight: 700, letterSpacing: '0.1em', fontSize: 13 }}>CONTROL</span>
            </Link>
          }
          actions={
            <>
              <Badge kind="info" label="GFX CONTROL PLANE" />
              <Button label="+ NEW" size="sm" variant="accent" onClick={() => setCreateOpen(true)} />
              <Button label="REFRESH" size="sm" onClick={() => void refresh()} />
            </>
          }
        >
          <Link
            to="/"
            style={{
              padding: '0 10px',
              color: 'var(--fg-2)',
              textDecoration: 'none',
              fontSize: 11,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            Home
          </Link>
        </NavBar>

        <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto', padding: 12 }}>
          <Outlet />
        </div>

        <StatusBar
          items={[
            {
              label: 'API',
              value: error ? error : loading ? 'LOADING' : 'OK',
              kind: error ? 'err' : loading ? 'warn' : 'ok',
            },
            { label: 'RUNDOWNS', value: String(rundowns.length), kind: 'info' },
          ]}
          right={<Badge kind="neutral" label="OPERATOR" style={{ margin: 'auto 8px' }} />}
        />

        <CreateRundownDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreate={createRundown}
        />
      </div>
    </ToastProvider>
  )
}
