import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { resetDbCache } from '#/control/server/db'
import { resetHub } from '#/control/server/hub'
import { resetSessions } from '#/control/server/sessions'
import {
  ensurePackagesLoaded,
  getDynamicTemplateSchema,
  listDynamicTemplates,
  listLoadedPackages,
  reloadPackages,
  resetPackagesCache,
} from '#/control/server/packages'
import { getTemplateSchema, listTemplatesPublic } from '#/templates/schemas'
import { applyCommand } from '#/control/server/commands'
import * as store from '#/control/server/store'
import { installServerRuntime } from '#/packages/runtime.server'

const FIXTURE_DIR = path.join(import.meta.dir, '../../.tmp-test-packages')

function resetAll() {
  resetPackagesCache()
  resetDbCache()
  resetHub()
  resetSessions()
  process.env.CONTROLLER_DB = ':memory:'
  process.env.HYDRA_PACKAGES_DIR = FIXTURE_DIR
}

function fixturePkgSource(opts: {
  id: string
  templateId: string
  titleDefault: string
  withCount?: boolean
  renderThrows?: boolean
}): string {
  const schemaExpr = opts.withCount
    ? `z.object({ title: z.string(), count: z.number().default(1) })`
    : `z.object({ title: z.string() })`
  const defaultsExpr = opts.withCount
    ? `{ title: ${JSON.stringify(opts.titleDefault)}, count: 1 }`
    : `{ title: ${JSON.stringify(opts.titleDefault)} }`
  const renderExpr = opts.renderThrows
    ? `() => { throw new Error('COMPONENT_MODULE_EVALUATED'); }`
    : `() => Promise.resolve({ default: function Render() { return null } })`

  return [
    `const z = globalThis.__HYDRA_GFX_RUNTIME__.require('zod');`,
    `const schema = ${schemaExpr};`,
    `const defaults = ${defaultsExpr};`,
    `export default {`,
    `  id: ${JSON.stringify(opts.id)},`,
    `  name: ${JSON.stringify(opts.id)},`,
    `  version: '1.0.0',`,
    `  templates: [{`,
    `    id: ${JSON.stringify(opts.templateId)},`,
    `    name: ${JSON.stringify(opts.templateId)},`,
    `    schema,`,
    `    defaults,`,
    `    fields: { title: { label: 'Title', section: 'CONTENT' } },`,
    `    transition: { inMs: 300, outMs: 200 },`,
    `    Render: ${renderExpr},`,
    `  }],`,
    `};`,
    `export const manifest = {`,
    `  formatVersion: 1,`,
    `  runtime: '^0.1.0',`,
    `  package: { id: ${JSON.stringify(opts.id)}, name: ${JSON.stringify(opts.id)}, version: '1.0.0' },`,
    `  templates: [{ id: ${JSON.stringify(opts.templateId)}, name: ${JSON.stringify(opts.templateId)}, defaults, fields: { title: { label: 'Title', section: 'CONTENT' } }, transition: { inMs: 300, outMs: 200 }, jsonSchema: { type: 'object' } }],`,
    `};`,
  ].join('\n')
}

describe('dynamic template packages', () => {
  beforeEach(async () => {
    resetAll()
    await rm(FIXTURE_DIR, { recursive: true, force: true })
    await mkdir(FIXTURE_DIR, { recursive: true })
    store.listRundowns()
    installServerRuntime()
  })

  afterEach(async () => {
    resetPackagesCache()
    resetDbCache()
    await rm(FIXTURE_DIR, { recursive: true, force: true })
    delete process.env.HYDRA_PACKAGES_DIR
  })

  test('loads package, merges catalog, validates props via dynamic zod schema', async () => {
    await writeFile(
      path.join(FIXTURE_DIR, 'fixture-pkg.hgfx.js'),
      fixturePkgSource({
        id: 'fixture-pkg',
        templateId: 'fixture-lower-third',
        titleDefault: 'Hello',
        withCount: true,
        renderThrows: true,
      }),
    )

    await reloadPackages()
    const pkgs = listLoadedPackages()
    expect(pkgs.length).toBe(1)
    expect(pkgs[0]!.id).toBe('fixture-pkg')
    expect(pkgs[0]!.error).toBeNull()
    expect(listDynamicTemplates().map((t) => t.id)).toContain('fixture-lower-third')

    const schema = getTemplateSchema('fixture-lower-third')
    expect(schema).toBeTruthy()
    expect(schema!.name).toBe('fixture-lower-third')
    expect(schema!.route).toBe('/graphics/p/fixture-pkg/fixture-lower-third')

    const publicMeta = listTemplatesPublic().find((t) => t.id === 'fixture-lower-third')
    expect(publicMeta?.packageId).toBe('fixture-pkg')

    const created = applyCommand({ type: 'rundown.create', name: 'Dyn Show' })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const added = applyCommand({
      type: 'instance.add',
      rundownId: created.rundownId!,
      templateId: 'fixture-lower-third',
      props: { title: 'On Air' },
    })
    expect(added.ok).toBe(true)
    if (!added.ok) return
    const upsert = added.events.find((e) => e.type === 'instance.upserted')
    expect(upsert?.type).toBe('instance.upserted')
    if (upsert?.type !== 'instance.upserted') return
    expect(upsert.instance.props.title).toBe('On Air')
    expect(upsert.instance.props.count).toBe(1)

    const rejected = applyCommand({
      type: 'instance.add',
      rundownId: created.rundownId!,
      templateId: 'fixture-lower-third',
      props: { title: 123 },
    })
    expect(rejected.ok).toBe(false)
  })

  test('Bun import yields schemas even when Render factory would throw', async () => {
    await writeFile(
      path.join(FIXTURE_DIR, 'lazy-pkg.hgfx.js'),
      fixturePkgSource({
        id: 'lazy-pkg',
        templateId: 'lazy-tpl',
        titleDefault: 'x',
        renderThrows: true,
      }),
    )
    installServerRuntime()
    const mod = (await import(
      path.resolve(FIXTURE_DIR, 'lazy-pkg.hgfx.js') + `?t=${Date.now()}`
    )) as {
      default: {
        id: string
        templates: Array<{
          schema: { safeParse: (v: unknown) => { success: boolean } }
          Render: () => unknown
        }>
      }
    }
    expect(mod.default.id).toBe('lazy-pkg')
    expect(mod.default.templates[0]!.schema.safeParse({ title: 'ok' }).success).toBe(true)
    expect(() => mod.default.templates[0]!.Render()).toThrow('COMPONENT_MODULE_EVALUATED')
  })

  test('hot reload picks up content hash change', async () => {
    await writeFile(
      path.join(FIXTURE_DIR, 'hot-pkg.hgfx.js'),
      fixturePkgSource({ id: 'hot-pkg', templateId: 'hot-tpl', titleDefault: 'v1' }),
    )
    await reloadPackages()
    const first = getDynamicTemplateSchema('hot-tpl')
    expect(first?.defaults.title).toBe('v1')
    const hash1 = listLoadedPackages()[0]!.contentHash

    await writeFile(
      path.join(FIXTURE_DIR, 'hot-pkg.hgfx.js'),
      fixturePkgSource({ id: 'hot-pkg', templateId: 'hot-tpl', titleDefault: 'v2' }),
    )
    await reloadPackages()
    const second = getDynamicTemplateSchema('hot-tpl')
    expect(second?.defaults.title).toBe('v2')
    const hash2 = listLoadedPackages()[0]!.contentHash
    expect(hash2).not.toBe(hash1)
  })

  test('static templates still resolve alongside dynamic', async () => {
    await ensurePackagesLoaded()
    expect(getTemplateSchema('labor-of-love-lower-third')?.id).toBe('labor-of-love-lower-third')
  })
})
