import { useEffect, useMemo } from 'react'
import { Link, Outlet, createFileRoute, useRouterState } from '@tanstack/react-router'
import { Badge, Breadcrumb } from '@hydra-tv/ui'
import { setActiveRundown, useRundownController, useTemplateCatalog } from '#/control/client'

export const Route = createFileRoute('/control/$rundownId')({
  ssr: false,
  component: RundownLayout,
})

type StaticTab = {
  kind: 'static'
  key: string
  label: string
  to: '/control/$rundownId' | '/control/$rundownId/templates' | '/control/$rundownId/packages' | '/control/$rundownId/renderers'
}

type PanelTab = {
  kind: 'panel'
  key: string
  label: string
  packageId: string
  panelId: string
}

type ShellTab = StaticTab | PanelTab

const STATIC_TABS: StaticTab[] = [
  { kind: 'static', key: 'playout', label: 'PLAYOUT', to: '/control/$rundownId' },
  { kind: 'static', key: 'templates', label: 'TEMPLATES', to: '/control/$rundownId/templates' },
  { kind: 'static', key: 'packages', label: 'PACKAGES', to: '/control/$rundownId/packages' },
  { kind: 'static', key: 'renderers', label: 'RENDERERS', to: '/control/$rundownId/renderers' },
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

function tabIsActive(tab: ShellTab, pathname: string, rundownId: string): boolean {
  if (tab.kind === 'panel') {
    return pathname.includes(`/panel/${tab.packageId}/${tab.panelId}`)
  }
  const base = `/control/${rundownId}`
  switch (tab.key) {
    case 'templates':
      return pathname.endsWith('/templates')
    case 'packages':
      return pathname.endsWith('/packages')
    case 'renderers':
      return pathname.endsWith('/renderers')
    default:
      return pathname === base || pathname === `${base}/`
  }
}

function RundownLayout() {
  const { rundownId } = Route.useParams()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { status, rundown, error, instances, packages: attachments } = useRundownController(rundownId)
  const { packages: catalog } = useTemplateCatalog()

  // Opening a rundown marks it as the default `/render` target.
  useEffect(() => {
    if (rundownId) setActiveRundown(rundownId)
  }, [rundownId])

  const tabs: ShellTab[] = useMemo(() => {
    const attachedIds = new Set(attachments.map((a) => a.packageId))
    const panelTabs: PanelTab[] = []
    for (const pkg of catalog) {
      if (!attachedIds.has(pkg.id) || pkg.error) continue
      for (const panel of pkg.panels ?? []) {
        panelTabs.push({
          kind: 'panel',
          key: `panel:${pkg.id}:${panel.id}`,
          label: panel.label,
          packageId: pkg.id,
          panelId: panel.id,
        })
      }
    }
    return [...STATIC_TABS, ...panelTabs]
  }, [attachments, catalog])

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

      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--line-2)', flexWrap: 'wrap' }}>
        {tabs.map((tab) => {
          const on = tabIsActive(tab, pathname, rundownId)
          const style = {
            height: 24,
            padding: '0 12px',
            fontSize: 10,
            letterSpacing: '0.08em',
            textTransform: 'uppercase' as const,
            fontFamily: 'var(--font-mono)',
            fontWeight: on ? 600 : 400,
            textDecoration: 'none' as const,
            display: 'inline-flex' as const,
            alignItems: 'center' as const,
            background: on ? 'var(--grad-btn)' : 'transparent',
            color: on ? 'var(--fg-1)' : 'var(--fg-3)',
            border: on ? '1px solid var(--btn-border)' : '1px solid transparent',
            borderBottom: on ? '1px solid var(--bg-2)' : '1px solid transparent',
            borderRadius: '2px 2px 0 0',
            marginBottom: -1,
            boxShadow: on ? 'inset 0 1px 0 #ffffff1a' : 'none',
          }

          if (tab.kind === 'panel') {
            return (
              <Link
                key={tab.key}
                to="/control/$rundownId/panel/$packageId/$panelId"
                params={{ rundownId, packageId: tab.packageId, panelId: tab.panelId }}
                style={style}
              >
                {tab.label}
              </Link>
            )
          }

          return (
            <Link key={tab.key} to={tab.to} params={{ rundownId }} style={style}>
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
