import type { CSSProperties } from 'react'

type MonitorWellProps = {
  tally: 'pgm' | 'pvw' | 'off'
  caption: string
  src?: string | null
  /** Show alpha as a checkerboard behind the iframe (for PGM / key preview). */
  transparent?: boolean
  style?: CSSProperties
}

const CHECKER: CSSProperties = {
  backgroundColor: '#0a0d10',
  backgroundImage: [
    'linear-gradient(45deg, #1a2028 25%, transparent 25%)',
    'linear-gradient(-45deg, #1a2028 25%, transparent 25%)',
    'linear-gradient(45deg, transparent 75%, #1a2028 75%)',
    'linear-gradient(-45deg, transparent 75%, #1a2028 75%)',
  ].join(', '),
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
}

export function MonitorWell({
  tally,
  caption,
  src,
  transparent = false,
  style,
}: MonitorWellProps) {
  const color =
    tally === 'pgm' ? 'var(--tally-pgm)' : tally === 'pvw' ? 'var(--tally-pvw)' : 'var(--fg-3)'

  return (
    <div
      style={{
        width: '100%',
        aspectRatio: '16/9',
        background: transparent ? undefined : '#030405',
        ...(transparent ? CHECKER : null),
        border: `1px solid ${tally === 'off' ? 'var(--line-1)' : color}`,
        borderRadius: 'var(--radius-1)',
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      {src ? (
        <iframe
          title={caption}
          src={src}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            border: 'none',
            background: 'transparent',
            colorScheme: 'normal',
          }}
        />
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-mono)',
            color,
            fontSize: 12,
            letterSpacing: '0.1em',
          }}
        >
          {caption}
        </div>
      )}
    </div>
  )
}
