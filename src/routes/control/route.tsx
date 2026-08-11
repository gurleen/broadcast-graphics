import { useMemo, useState } from 'react'
import { Link, Outlet, createFileRoute, useNavigate, useRouterState } from '@tanstack/react-router'
import { Badge, Button, NavBar, SideNav, Spinner, ToastProvider } from '@gurleen-ui/core'
import { StatusBar } from '@gurleen-ui/broadcast'
import { useRundownList } from '#/control/client'
import { CreateRundownDialog } from './-CreateRundownDialog'

export const Route = createFileRoute('/control')({
  ssr: false,
  component: ControlLayout,
})

function ControlLayout() {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { rundowns, loading, error, refresh, createRundown } = useRundownList()
  const [createOpen, setCreateOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const activeRundownId = useMemo(() => {
    const match = pathname.match(/^\/control\/([^/]+)/)
    return match?.[1] ?? undefined
  }, [pathname])

  const sideItems = useMemo(
    () =>
      rundowns.map((r) => ({
        key: r.id,
        label: r.name,
        icon: (
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0 }}>
            {(r.name.trim()[0] ?? '?').toUpperCase()}
          </span>
        ),
      })),
    [rundowns],
  )

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

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <div
            style={{
              width: sidebarCollapsed ? 44 : 200,
              flexShrink: 0,
              borderRight: '1px solid var(--line-1)',
              padding: sidebarCollapsed ? '8px 0' : 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              background: 'var(--bg-0)',
              transition: 'width 120ms ease',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: sidebarCollapsed ? 'center' : 'space-between',
                gap: 4,
                padding: sidebarCollapsed ? 0 : '0 0 0 8px',
                minHeight: 24,
              }}
            >
              {!sidebarCollapsed ? (
                <div
                  style={{
                    fontSize: 9,
                    letterSpacing: '0.14em',
                    color: 'var(--fg-3)',
                    fontWeight: 700,
                  }}
                >
                  RUNDOWNS
                </div>
              ) : null}
              <Button
                label={sidebarCollapsed ? '›' : '‹'}
                size="sm"
                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                onClick={() => setSidebarCollapsed((c) => !c)}
                style={{ minWidth: 28, padding: '0 6px' }}
              />
            </div>
            {loading && rundowns.length === 0 ? (
              <div style={{ display: 'grid', placeItems: 'center', padding: sidebarCollapsed ? 8 : 24 }}>
                <Spinner />
              </div>
            ) : sideItems.length === 0 ? (
              sidebarCollapsed ? null : (
                <div style={{ fontSize: 11, color: 'var(--fg-3)', padding: '8px' }}>
                  No rundowns yet.
                </div>
              )
            ) : (
              <SideNav
                items={sideItems}
                active={activeRundownId}
                collapsed={sidebarCollapsed}
                width={184}
                onChange={(id) => {
                  void navigate({ to: '/control/$rundownId', params: { rundownId: id } })
                }}
              />
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto', padding: 12 }}>
            <Outlet />
          </div>
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
