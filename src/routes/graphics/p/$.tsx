import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { PreviewToolbarLayout } from '#/graphics/preview/PreviewToolbarLayout'
import { PREVIEW_TOOLBAR_SLOT_ID } from '#/graphics/GraphicStage'
import { useControlledGraphic, useTemplateCatalog } from '#/control/client'
import { loadPackage, loadPreviewControls } from '#/packages/loader'
import { installClientRuntime } from '#/packages/runtime'
import type { ComponentType } from 'react'
import type { TemplateControlsProps, TemplateSchema } from '#/templates/types'
import type { TemplateDefinition } from '#/templates/types'

export const Route = createFileRoute('/graphics/p/$')({
  ssr: false,
  component: DynamicGraphicRoute,
})

const graphicsRoute = getRouteApi('/graphics')

function parseSplat(splat: string | undefined): { packageId: string; templateId: string } | null {
  if (!splat) return null
  const parts = splat.split('/').filter(Boolean)
  if (parts.length < 2) return null
  const packageId = parts[0]!
  const templateId = parts.slice(1).join('/')
  return { packageId, templateId }
}

function DynamicGraphicRoute() {
  const params = Route.useParams()
  const splat =
    (params as { _splat?: string })._splat ??
    (typeof (params as { '*': string })['*'] === 'string'
      ? (params as { '*': string })['*']
      : undefined)
  const parsed = parseSplat(splat)
  const { preview } = graphicsRoute.useSearch()
  const { packages, templates } = useTemplateCatalog()
  const [def, setDef] = useState<TemplateDefinition<Record<string, unknown>> | null>(null)
  const [PreviewControls, setPreviewControls] = useState<
    ComponentType<TemplateControlsProps<Record<string, unknown>>> | null
  >(null)
  const [error, setError] = useState<string | null>(null)
  const [toolbarSlot, setToolbarSlot] = useState<HTMLElement | null>(null)

  const pkgEntry = useMemo(() => {
    if (!parsed) return null
    return packages.find((p) => p.id === parsed.packageId) ?? null
  }, [packages, parsed])

  const catalogTemplate = useMemo(() => {
    if (!parsed) return null
    return templates.find((t) => t.id === parsed.templateId) ?? null
  }, [templates, parsed])

  useEffect(() => {
    installClientRuntime()
    if (!parsed || !pkgEntry || pkgEntry.error) {
      setDef(null)
      if (parsed && !pkgEntry) setError(`Package not found: ${parsed.packageId}`)
      else if (pkgEntry?.error) setError(pkgEntry.error)
      return
    }

    let cancelled = false
    setError(null)
    void loadPackage({
      id: pkgEntry.id,
      name: pkgEntry.name,
      version: pkgEntry.version,
      bundleUrl: pkgEntry.bundleUrl,
      contentHash: pkgEntry.contentHash,
    })
      .then((loaded) => {
        if (cancelled) return
        const t = loaded.templates.get(parsed.templateId)
        if (!t) {
          setError(`Template ${parsed.templateId} not in package ${parsed.packageId}`)
          setDef(null)
          return
        }
        setDef(t)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })

    void loadPreviewControls(
      {
        id: pkgEntry.id,
        name: pkgEntry.name,
        version: pkgEntry.version,
        bundleUrl: pkgEntry.bundleUrl,
        contentHash: pkgEntry.contentHash,
      },
      parsed.templateId,
    ).then((C) => {
      if (!cancelled) {
        // Component types are functions — must wrap so React doesn't treat the
        // value as a setState updater (which would call C(null)).
        setPreviewControls(() => C ?? null)
      }
    })

    return () => {
      cancelled = true
    }
  }, [parsed, pkgEntry])

  useLayoutEffect(() => {
    if (!preview) {
      setToolbarSlot(null)
      return
    }
    setToolbarSlot(document.getElementById(PREVIEW_TOOLBAR_SLOT_ID))
  }, [preview])

  if (!parsed) {
    return <ErrorBox message="Expected /graphics/p/<packageId>/<templateId>" />
  }
  if (error) return <ErrorBox message={error} />
  if (!def) return <ErrorBox message="Loading package…" dim />

  return (
    <DynamicGraphicInner
      schema={def}
      Render={def.Render}
      preview={preview}
      toolbarSlot={toolbarSlot}
      PreviewControls={PreviewControls}
      catalogName={catalogTemplate?.name}
    />
  )
}

function DynamicGraphicInner({
  schema,
  Render,
  preview,
  toolbarSlot,
  PreviewControls,
}: {
  schema: TemplateSchema<Record<string, unknown>>
  Render: TemplateDefinition<Record<string, unknown>>['Render']
  preview: boolean
  toolbarSlot: HTMLElement | null
  PreviewControls: ComponentType<TemplateControlsProps<Record<string, unknown>>> | null
  catalogName?: string
}) {
  const { props, onScreen, patchProps, setProps, setOnScreen } = useControlledGraphic(schema)

  return (
    <>
      <Render props={props} onScreen={onScreen} />
      {toolbarSlot && preview
        ? createPortal(
            <PreviewToolbarLayout onIn={() => setOnScreen(true)} onOut={() => setOnScreen(false)}>
              {PreviewControls ? (
                <PreviewControls
                  props={props}
                  patch={patchProps}
                  replace={setProps}
                  onScreen={onScreen}
                  setOnScreen={setOnScreen}
                />
              ) : (
                <div style={{ fontSize: 10, color: 'var(--fg-3)', padding: 8 }}>
                  No preview controls for this template.
                </div>
              )}
            </PreviewToolbarLayout>,
            toolbarSlot,
          )
        : null}
    </>
  )
}

function ErrorBox({ message, dim }: { message: string; dim?: boolean }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        color: dim ? 'rgba(255,255,255,0.5)' : 'rgba(255,120,120,0.9)',
        fontFamily: 'monospace',
        fontSize: 14,
        pointerEvents: 'none',
      }}
    >
      {message}
    </div>
  )
}
