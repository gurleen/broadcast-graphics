import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { LauncherTile } from '@hydra-tv/ui'

export const Route = createFileRoute('/')({ component: Home })

function RundownIcon() {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" />
    </svg>
  )
}

function Home() {
  const navigate = useNavigate()

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--bg-1)',
        color: 'var(--fg-1)',
        fontFamily: 'var(--font-mono)',
      }}
    >
      <div
        style={{
          height: 44,
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          padding: '0 var(--sp-6)',
          background: 'var(--grad-panel)',
          borderBottom: '1px solid var(--line-2)',
          boxShadow: 'var(--shadow-panel)',
          fontSize: 11,
          letterSpacing: '0.06em',
        }}
      >
        <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span style={{ fontWeight: 700, letterSpacing: '0.1em', fontSize: 13 }}>HYDRA // GFX</span>
        </Link>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
          padding: 24,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Launch
          </div>
          <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>
            Choose a surface to open.
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 160px))',
            gap: 16,
            justifyContent: 'center',
            width: '100%',
            maxWidth: 520,
          }}
        >
          <LauncherTile
            label="RUNDOWNS"
            description="Playout and templates"
            icon={<RundownIcon />}
            onClick={() => {
              void navigate({ to: '/control' })
            }}
          />
        </div>
      </div>
    </div>
  )
}
