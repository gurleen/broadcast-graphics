import { FieldRow, Input } from '@hydra-tv/ui'
import type { PackagePanelProps } from '@hydra-tv/hydra-gfx-runtime/types'
import type { ExampleConfig } from '../live-data'

/**
 * Package-registered rundown tab — edits the example package's `prefix` config
 * (drives the ticker feed provider). Appears next to PLAYOUT/… once the rundown
 * attaches `example-pkg`.
 */
export default function ExampleConfigPanel({
  config,
  patchConfig,
  data,
  providers,
}: PackagePanelProps<ExampleConfig>) {
  const ticker = data.find((d) => d.key === 'ticker')
  const feed = providers.find((p) => p.providerId === 'example-ticker-feed')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 480 }}>
      <FieldRow label="Prefix" style={{ alignItems: 'center', minWidth: 0 }}>
        <Input
          value={config.prefix ?? ''}
          width="100%"
          onChange={(v) => patchConfig({ prefix: String(v) })}
        />
      </FieldRow>
      <div style={{ fontSize: 10, color: 'var(--fg-3)', lineHeight: 1.4 }}>
        Provider status: <code>{(feed?.state ?? 'idle').toUpperCase()}</code>
        {feed?.message ? ` — ${feed.message}` : null}
      </div>
      {ticker ? (
        <div style={{ fontSize: 10, color: 'var(--fg-3)', lineHeight: 1.4 }}>
          Live <code>ticker</code> (rev {ticker.revision}): {JSON.stringify(ticker.value)}
        </div>
      ) : (
        <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>No ticker data published yet.</div>
      )}
    </div>
  )
}
