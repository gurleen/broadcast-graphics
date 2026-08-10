import type { ReactNode } from 'react'
import { PreviewTransport } from './PreviewTransport'

type PreviewToolbarLayoutProps = {
  onIn: () => void
  onOut: () => void
  onReset?: () => void
  children?: ReactNode
}

export function PreviewToolbarLayout({
  onIn,
  onOut,
  onReset,
  children,
}: PreviewToolbarLayoutProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
      }}
    >
      <PreviewTransport onIn={onIn} onOut={onOut} onReset={onReset} />
      {children}
    </div>
  )
}
