import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import { NavBar, ToastProvider } from '@gurleen-ui/core'
import { StatusBar } from '@gurleen-ui/broadcast'
import { useRundownList } from '#/control/client'

export const Route = createFileRoute('/control')({
  ssr: false,
  component: ControlLayout,
})

function ControlLayout() {
  const { rundowns, loading, error } = useRundownList()

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
        />
      </div>
    </ToastProvider>
  )
}
