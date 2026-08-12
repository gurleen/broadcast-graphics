import { useEffect } from 'react'
import { Link, Outlet, createFileRoute, useRouterState } from '@tanstack/react-router'
import { Badge, Breadcrumb } from '@hydra-tv/ui'
import { setActiveRundown, useRundownController } from '#/control/client'

export const Route = createFileRoute('/control/$rundownId')({
  ssr: false,
  component: RundownLayout,
})

const TABS = [
  { label: 'PLAYOUT', to: '/control/$rundownId' as const },
  { label: 'TEMPLATES', to: '/control/$rundownId/templates' as const },
  { label: 'PACKAGES', to: '/control/$rundownId/packages' as const },
  { label: 'RENDERERS', to: '/control/$rundownId/renderers' as const },
]

function statusBadgeKind(status: string): 'info' | 'warn' | 'err' | 'neutral' {
  switch (status) {
    case 'open':
      return 'info'
    case 'connecting':
    case 'reconnecting':
      return 'warn'
    case 'closed':
      return 'err'
    default:
      return 'neutral'
  }
}

function RundownLayout() {
  const { rundownId } = Route.useParams()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { status, rundown, error, instances } = useRundownController(rundownId)

  // Opening a rundown marks it as the default `/render` target.
  useEffect(() => {
    if (rundownId) setActiveRundown(rundownId)
  }, [rundownId])

  const activeTab = (() => {
    if (pathname.endsWith('/templates')) return 1
    if (pathname.endsWith('/packages')) return 2
    if (pathname.endsWith('/renderers')) return 3
    return 0
  })()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <Breadcrumb
          items={[
            { label: 'Control', href: '/control' },
            { label: rundown?.name ?? rundownId },
          ]}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {rundown?.name ?? 'Loading…'}
          </span>
          <Badge kind={statusBadgeKind(status)} label={status.toUpperCase()} dot />
          <Badge kind="neutral" label={`${instances.length} INST`} />
          {error ? <Badge kind="err" label={error.message} /> : null}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--line-2)' }}>
        {TABS.map((tab, i) => {
          const on = i === activeTab
          return (
            <Link
              key={tab.label}
              to={tab.to}
              params={{ rundownId }}
              style={{
                height: 24,
                padding: '0 12px',
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontFamily: 'var(--font-mono)',
                fontWeight: on ? 600 : 400,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                background: on ? 'var(--grad-btn)' : 'transparent',
                color: on ? 'var(--fg-1)' : 'var(--fg-3)',
                border: on ? '1px solid var(--btn-border)' : '1px solid transparent',
                borderBottom: on ? '1px solid var(--bg-2)' : '1px solid transparent',
                borderRadius: '2px 2px 0 0',
                marginBottom: -1,
                boxShadow: on ? 'inset 0 1px 0 #ffffff1a' : 'none',
              }}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </div>
    </div>
  )
}
