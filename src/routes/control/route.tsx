import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import { NavBar, ToastProvider, useToast } from '@hydra-tv/ui'
import { StatusBar } from '@hydra-tv/broadcast'
import { useRundownList } from '#/control/client'

export const Route = createFileRoute('/control')({
  ssr: false,
  component: ControlLayout,
})

function defaultRenderUrl(): string {
  if (typeof window === 'undefined') return '/render'
  return new URL('/render', window.location.origin).href
}

function ControlLayout() {
  return (
    <ToastProvider>
      <ControlShell />
    </ToastProvider>
  )
}

function ControlShell() {
  const { rundowns, loading, error } = useRundownList()
  const toast = useToast()

  const copyDefaultRenderUrl = async () => {
    const url = defaultRenderUrl()
    try {
      await navigator.clipboard.writeText(url)
      toast.show({ level: 'ok', message: 'Copied default render URL', detail: url })
    } catch {
      toast.show({ level: 'err', message: 'Copy failed', detail: url })
    }
  }

  return (
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
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span style={{ fontWeight: 700, letterSpacing: '0.1em', fontSize: 13 }}>HYDRA // GFX</span>
          </Link>
        }
      >
        <Link
          to="/control"
          style={{
            padding: '0 10px',
            color: 'var(--fg-2)',
            textDecoration: 'none',
            fontSize: 11,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          Rundowns
        </Link>
        <Link
          to="/control/packages"
          style={{
            padding: '0 10px',
            color: 'var(--fg-2)',
            textDecoration: 'none',
            fontSize: 11,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          Packages
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
          {
            label: 'OBS',
            value: '/RENDER',
            kind: 'info',
            title: 'Copy default composite URL for OBS',
            onClick: () => void copyDefaultRenderUrl(),
          },
        ]}
      />
    </div>
  )
}
