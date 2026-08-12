import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Badge, Button, Panel, Spinner, useToast } from '@hydra-tv/ui'
import { useRundownController, useTemplateCatalog } from '#/control/client'
import { PackageConfigEditor } from './-PackageConfigEditor'

export const Route = createFileRoute('/control/$rundownId/packages')({
  ssr: false,
  component: RundownPackagesPage,
})

function providerStateBadge(state: string): 'info' | 'warn' | 'err' | 'neutral' {
  switch (state) {
    case 'ok':
      return 'info'
    case 'starting':
      return 'warn'
    case 'error':
      return 'err'
    default:
      return 'neutral'
  }
}

function RundownPackagesPage() {
  const { rundownId } = Route.useParams()
  const toast = useToast()
  const { packages: catalog, loading, error } = useTemplateCatalog()
  const {
    packages: attachments,
    providers,
    data,
    attachPackage,
    detachPackage,
    patchPackageConfig,
  } = useRundownController(rundownId)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const attachedById = useMemo(
    () => new Map(attachments.map((a) => [a.packageId, a])),
    [attachments],
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', minHeight: 0 }}>
      <Panel
        title="PACKAGES"
        meta={`${attachments.length} ATTACHED`}
        padded={false}
        style={{ flex: 1, minHeight: 0, overflow: 'auto' }}
      >
        {loading && catalog.length === 0 ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}>
            <Spinner />
          </div>
        ) : catalog.length === 0 ? (
          <div style={{ padding: 16, fontSize: 11, color: 'var(--fg-3)' }}>
            No packages installed. Install one from <code>/control/packages</code>.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {catalog.map((pkg) => {
              const attachment = attachedById.get(pkg.id)
              const attached = Boolean(attachment)
              const expanded = expandedId === pkg.id
              const pkgProviders = providers.filter((p) => p.packageId === pkg.id)
              const pkgData = data.filter((d) => d.packageId === pkg.id)

              return (
                <div key={pkg.id} style={{ borderBottom: '1px solid var(--line-1)' }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto auto',
                      gap: 12,
                      padding: '12px 14px',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 12, letterSpacing: '0.06em' }}>
                          {pkg.name}
                        </span>
                        <Badge kind="neutral" label={`v${pkg.version}`} />
                        {attached ? <Badge kind="info" label="ATTACHED" /> : null}
                        {pkg.config ? <Badge kind="neutral" label="CONFIG" /> : null}
                        {pkg.providers.length > 0 ? (
                          <Badge kind="neutral" label={`${pkg.providers.length} PROVIDER${pkg.providers.length === 1 ? '' : 'S'}`} />
                        ) : null}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 4 }}>
                        id <code>{pkg.id}</code>
                      </div>
                    </div>
                    <Button
                      label={attached ? 'DETACH' : 'ATTACH'}
                      size="sm"
                      variant={attached ? 'take' : 'accent'}
                      onClick={async () => {
                        const result = attached
                          ? await detachPackage(pkg.id)
                          : await attachPackage(pkg.id)
                        if (!result.ok) {
                          toast.show({ level: 'err', message: 'Failed', detail: result.error.message })
                          return
                        }
                        toast.show({
                          level: 'ok',
                          message: attached ? 'Detached' : 'Attached',
                          detail: pkg.name,
                        })
                        if (!attached) setExpandedId(pkg.id)
                      }}
                    />
                    <Button
                      label={expanded ? 'HIDE' : 'DETAILS'}
                      size="sm"
                      disabled={!attached}
                      onClick={() => setExpandedId(expanded ? null : pkg.id)}
                    />
                  </div>

                  {attached && expanded && attachment ? (
                    <div
                      style={{
                        padding: '4px 14px 16px',
                        display: 'flex',
                        gap: 16,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <div
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            letterSpacing: '0.14em',
                            textTransform: 'uppercase',
                            color: 'var(--fg-3)',
                            marginBottom: 6,
                          }}
                        >
                          CONFIG
                        </div>
                        <PackageConfigEditor
                          pkg={pkg}
                          config={attachment.config}
                          onPatch={(patch) => void patchPackageConfig(pkg.id, patch)}
                        />
                      </div>

                      {pkg.providers.length > 0 ? (
                        <div style={{ flex: 1, minWidth: 220 }}>
                          <div
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              letterSpacing: '0.14em',
                              textTransform: 'uppercase',
                              color: 'var(--fg-3)',
                              marginBottom: 6,
                            }}
                          >
                            PROVIDERS
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {pkg.providers.map((provider) => {
                              const status = pkgProviders.find((s) => s.providerId === provider.id)
                              return (
                                <div
                                  key={provider.id}
                                  style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11 }}
                                >
                                  <Badge
                                    kind={providerStateBadge(status?.state ?? 'idle')}
                                    label={(status?.state ?? 'idle').toUpperCase()}
                                    dot
                                  />
                                  <span>{provider.name}</span>
                                  {status?.message ? (
                                    <span style={{ color: 'var(--err)' }}>— {status.message}</span>
                                  ) : null}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ) : null}

                      {pkgData.length > 0 ? (
                        <div style={{ flex: 1, minWidth: 220 }}>
                          <div
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              letterSpacing: '0.14em',
                              textTransform: 'uppercase',
                              color: 'var(--fg-3)',
                              marginBottom: 6,
                            }}
                          >
                            LIVE DATA
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {pkgData.map((d) => (
                              <div key={d.key} style={{ fontSize: 10, color: 'var(--fg-3)' }}>
                                <code>{d.key}</code> · rev {d.revision} ·{' '}
                                {JSON.stringify(d.value)}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </Panel>

      {error ? <Badge kind="err" label={error} /> : null}
    </div>
  )
}
