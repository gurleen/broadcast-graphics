import { useEffect, useMemo, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Panel, Spinner } from '@hydra-tv/ui'
import type { ComponentType, ReactNode } from 'react'
import type { PackagePanelProps } from '#/templates/types'
import { useRundownController, useTemplateCatalog } from '#/control/client'
import { loadPackagePanel } from '#/packages/loader'

export const Route = createFileRoute('/control/$rundownId/panel/$packageId/$panelId')({
  ssr: false,
  component: PackagePanelPage,
})

function PackagePanelPage() {
  const { rundownId, packageId, panelId } = Route.useParams()
  const { packages: catalog } = useTemplateCatalog()
  const {
    packages: attachments,
    data,
    providers,
    patchPackageConfig,
    replacePackageConfig,
    publishData,
    clearData,
    startProvider,
    stopProvider,
  } = useRundownController(rundownId)

  const catalogPkg = useMemo(
    () => catalog.find((p) => p.id === packageId) ?? null,
    [catalog, packageId],
  )
  const attachment = useMemo(
    () => attachments.find((a) => a.packageId === packageId) ?? null,
    [attachments, packageId],
  )
  const panelMeta = catalogPkg?.panels.find((p) => p.id === panelId)

  const [PanelComponent, setPanelComponent] = useState<
    ComponentType<PackagePanelProps<Record<string, unknown>>> | null
  >(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!catalogPkg || catalogPkg.error || !attachment || !panelMeta) {
      setPanelComponent(null)
      setLoadError(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setLoadError(null)
    void loadPackagePanel(
      {
        id: catalogPkg.id,
        name: catalogPkg.name,
        version: catalogPkg.version,
        bundleUrl: catalogPkg.bundleUrl,
        contentHash: catalogPkg.contentHash,
      },
      panelId,
    )
      .then((resolved) => {
        if (cancelled) return
        if (!resolved) {
          setLoadError(`Panel "${panelId}" not found in package ${packageId}`)
          setPanelComponent(null)
          return
        }
        // Component types are functions — wrap so React doesn't treat as setState updater.
        setPanelComponent(() => resolved.Panel)
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : String(err))
          setPanelComponent(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [catalogPkg, attachment, panelMeta, packageId, panelId])

  if (!catalogPkg) {
    return (
      <EmptyState
        message={`Package "${packageId}" is not installed.`}
        detail={
          <Link to="/control/packages" style={{ color: 'var(--accent)', fontSize: 11 }}>
            Open package installer
          </Link>
        }
      />
    )
  }

  if (!attachment) {
    return (
      <EmptyState
        message={`Attach ${catalogPkg.name} on the PACKAGES tab to use this panel.`}
        detail={
          <Link
            to="/control/$rundownId/packages"
            params={{ rundownId }}
            style={{ color: 'var(--accent)', fontSize: 11 }}
          >
            Go to PACKAGES
          </Link>
        }
      />
    )
  }

  if (!panelMeta) {
    return <EmptyState message={`Panel "${panelId}" is not declared by ${catalogPkg.name}.`} />
  }

  if (loading && !PanelComponent) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', flex: 1, padding: 48 }}>
        <Spinner />
      </div>
    )
  }

  if (loadError || !PanelComponent) {
    return <EmptyState message={loadError ?? 'Failed to load panel.'} />
  }

  const pkgData = data
    .filter((d) => d.packageId === packageId)
    .map((d) => ({
      key: d.key,
      value: d.value,
      revision: d.revision,
      updatedAt: d.updatedAt,
    }))
  const pkgProviders = providers
    .filter((p) => p.packageId === packageId)
    .map((p) => ({
      packageId: p.packageId,
      providerId: p.providerId,
      state: p.state,
      message: p.message,
      at: p.at,
    }))

  const config = {
    ...(catalogPkg.config?.defaults ?? {}),
    ...attachment.config,
  }

  return (
    <Panel
      title={panelMeta.label}
      meta={catalogPkg.name}
      style={{ flex: 1, minHeight: 0, overflow: 'auto' }}
    >
      <PanelComponent
        rundownId={rundownId}
        packageId={packageId}
        config={config}
        patchConfig={(patch) => void patchPackageConfig(packageId, patch as Record<string, unknown>)}
        replaceConfig={(next) =>
          void replacePackageConfig(packageId, next as Record<string, unknown>)
        }
        data={pkgData}
        providers={pkgProviders}
        publishData={(key, value) => void publishData(packageId, key, value)}
        clearData={(key) => void clearData(packageId, key)}
        startProvider={(providerId) => void startProvider(packageId, providerId)}
        stopProvider={(providerId) => void stopProvider(packageId, providerId)}
      />
    </Panel>
  )
}

function EmptyState({ message, detail }: { message: string; detail?: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        alignItems: 'flex-start',
        padding: 24,
        fontSize: 12,
        color: 'var(--fg-3)',
      }}
    >
      <span>{message}</span>
      {detail}
    </div>
  )
}
