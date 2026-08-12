import { Badge, Button, FieldRow, Input } from '@hydra-tv/ui'
import type { PackagePanelProps } from '@hydra-tv/hydra-gfx-runtime/types'
import type { ExampleConfig } from '../live-data'

const FEED_ID = 'example-ticker-feed'

/**
 * Package-registered rundown tab — edits the example package's `prefix` config
 * and start/stops the ticker feed provider. Appears next to PLAYOUT/… once the
 * rundown attaches `example-pkg`.
 */
export default function ExampleConfigPanel({
  config,
  patchConfig,
  data,
  providers,
  startProvider,
  stopProvider,
}: PackagePanelProps<ExampleConfig>) {
  const ticker = data.find((d) => d.key === 'ticker')
  const feed = providers.find((p) => p.providerId === FEED_ID)
  const state = feed?.state ?? 'idle'
  const running = state === 'ok' || state === 'starting'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 520 }}>
      <FieldRow label="Prefix" style={{ alignItems: 'center', minWidth: 0 }}>
        <Input
          value={config.prefix ?? ''}
          width="100%"
          onChange={(v) => patchConfig({ prefix: String(v) })}
        />
      </FieldRow>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          paddingTop: 8,
          borderTop: '1px solid var(--line-1)',
        }}
      >
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--fg-3)',
          }}
        >
          Ticker feed
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Badge
            kind={
              state === 'ok'
                ? 'info'
                : state === 'error'
                  ? 'err'
                  : state === 'starting'
                    ? 'warn'
                    : 'neutral'
            }
            label={state.toUpperCase()}
            dot
          />
          {feed?.message ? (
            <span style={{ fontSize: 10, color: 'var(--err)' }}>{feed.message}</span>
          ) : null}
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
            <Button
              label="START"
              size="sm"
              variant="accent"
              disabled={running}
              onClick={() => startProvider(FEED_ID)}
            />
            <Button
              label="STOP"
              size="sm"
              variant="take"
              disabled={!running}
              onClick={() => stopProvider(FEED_ID)}
            />
          </div>
        </div>
        {ticker ? (
          <div style={{ fontSize: 10, color: 'var(--fg-3)', lineHeight: 1.4 }}>
            Live <code>ticker</code> (rev {ticker.revision}): {JSON.stringify(ticker.value)}
          </div>
        ) : (
          <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>No ticker data published yet.</div>
        )}
      </div>
    </div>
  )
}
