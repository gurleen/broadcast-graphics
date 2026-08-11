import { useEffect, useState } from 'react'

const familyByUrl = new Map<string, string>()
const loadByUrl = new Map<string, Promise<string>>()

function familyNameForUrl(url: string) {
  const existing = familyByUrl.get(url)
  if (existing) return existing
  const name = `HtmlUiFont_${Math.random().toString(36).slice(2, 10)}`
  familyByUrl.set(url, name)
  return name
}

function loadFont(url: string): Promise<string> {
  const cached = loadByUrl.get(url)
  if (cached) return cached

  const promise = (async () => {
    const family = familyNameForUrl(url)
    const face = new FontFace(family, `url(${url})`)
    await face.load()
    document.fonts.add(face)
    return family
  })()

  loadByUrl.set(url, promise)
  return promise
}

/**
 * Loads a web font from `url` and returns its registered `font-family` name once
 * ready. Returns `undefined` until loaded (browser default font is used meanwhile).
 */
export function useWebFont(url?: string): string | undefined {
  const [family, setFamily] = useState<string | undefined>(() =>
    url ? familyByUrl.get(url) : undefined,
  )

  useEffect(() => {
    if (!url) {
      setFamily(undefined)
      return
    }

    const known = familyByUrl.get(url)
    if (known && document.fonts.check(`16px ${known}`)) {
      setFamily(known)
      return
    }

    let cancelled = false
    loadFont(url)
      .then((name) => {
        if (!cancelled) setFamily(name)
      })
      .catch(() => {
        if (!cancelled) setFamily(undefined)
      })

    return () => {
      cancelled = true
    }
  }, [url])

  return family
}
