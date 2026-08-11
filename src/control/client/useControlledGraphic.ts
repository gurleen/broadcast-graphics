import { useCallback, useEffect, useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import type { TemplateSchema } from '#/templates/types'
import { useGraphicInstance, usePlaybackReporter } from './useRundownController'

const graphicsRoute = getRouteApi('/graphics')

export type ControlledGraphicResult<TProps extends Record<string, unknown>> = {
  props: TProps
  onScreen: boolean
  setProps: (next: TProps | ((prev: TProps) => TProps)) => void
  patchProps: (patch: Partial<TProps>) => void
  setOnScreen: (onScreen: boolean) => void
  /** True when driven by the control server (`?rundown=&instance=`). */
  controlled: boolean
  status: string
  revision: number
}

/**
 * Drop-in replacement for local `useState` pairs on graphic routes.
 *
 * Without `rundown`/`instance` search params → pure local state (preview).
 * With them → server state; local setters become control commands.
 */
export function useControlledGraphic<TProps extends Record<string, unknown>>(
  template: TemplateSchema<TProps>,
  options?: { initial?: TProps; initialOnScreen?: boolean },
): ControlledGraphicResult<TProps> {
  const search = graphicsRoute.useSearch()
  const rundownId = typeof search.rundown === 'string' ? search.rundown : undefined
  const instanceId = typeof search.instance === 'string' ? search.instance : undefined
  const forceOnScreen = Boolean(search.forceOnScreen)
  const controlled = Boolean(rundownId && instanceId)

  const [localProps, setLocalProps] = useState<TProps>(
    () => options?.initial ?? template.defaults,
  )
  const [localOnScreen, setLocalOnScreen] = useState(options?.initialOnScreen ?? true)

  const remote = useGraphicInstance({
    rundownId: controlled ? rundownId : undefined,
    instanceId: controlled ? instanceId : undefined,
    templateId: template.id,
  })

  const props = controlled && remote.props ? (remote.props as TProps) : localProps

  // PVW: wait for server props, then force onScreen so initial→visible plays the IN animation.
  // Do not report phases — this embed is display-only and must not look like PGM.
  const onScreen = forceOnScreen
    ? Boolean(controlled && remote.props)
    : controlled
      ? remote.onScreen
      : localOnScreen

  usePlaybackReporter({
    onScreen: controlled ? remote.onScreen : localOnScreen,
    revision: controlled ? remote.revision : 0,
    transition: template.transition,
    report: remote.reportPhase,
    enabled: controlled && !forceOnScreen,
  })

  // Seed local state from remote when first connected (optional convenience).
  useEffect(() => {
    if (!controlled || !remote.props) return
    setLocalProps(remote.props as TProps)
    setLocalOnScreen(remote.onScreen)
  }, [controlled, remote.revision]) // eslint-disable-line react-hooks/exhaustive-deps

  const sendCommand = remote.sendCommand

  const setProps = useCallback(
    (next: TProps | ((prev: TProps) => TProps)) => {
      if (!controlled || !instanceId) {
        setLocalProps(next)
        return
      }
      setLocalProps((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next
        void sendCommand({
          type: 'instance.replaceProps',
          instanceId,
          props: resolved as Record<string, unknown>,
        })
        return resolved
      })
    },
    [controlled, instanceId, sendCommand],
  )

  const patchProps = useCallback(
    (patch: Partial<TProps>) => {
      if (!controlled || !instanceId) {
        setLocalProps((prev) => ({ ...prev, ...patch }))
        return
      }
      void sendCommand({
        type: 'instance.patchProps',
        instanceId,
        patch: patch as Record<string, unknown>,
      })
    },
    [controlled, instanceId, sendCommand],
  )

  const setOnScreen = useCallback(
    (value: boolean) => {
      if (!controlled || !instanceId) {
        setLocalOnScreen(value)
        return
      }
      void sendCommand({
        type: value ? 'playout.in' : 'playout.out',
        instanceId,
      })
    },
    [controlled, instanceId, sendCommand],
  )

  return {
    props,
    onScreen,
    setProps,
    patchProps,
    setOnScreen,
    controlled,
    status: controlled ? remote.status : 'local',
    revision: controlled ? remote.revision : 0,
  }
}
