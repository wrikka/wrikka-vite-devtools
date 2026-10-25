import { describe, expect, it } from 'bun:test'
import type { DevframeHubContext } from '@devframes/hub/node'
import { createDevframes, registerPanelDocks, resolvePluginKeys } from '../src/add-ons'

const base = '/__devtools/wrikka-vite-devtools/'

function fakeContext() {
  const docks: { id: string; title: string; url: string; category: string }[] = []
  const ctx = {
    frames: [{ id: 'wrikka-vite-devtools', base }],
    docks: { register: (dock: (typeof docks)[number]) => docks.push(dock) },
  } as unknown as DevframeHubContext
  return { ctx, docks }
}

describe('resolvePluginKeys', () => {
  it('includes the solid panel in the default set', () => {
    expect(resolvePluginKeys()).toContain('solid')
    expect(resolvePluginKeys('all')).toContain('solid')
  })

  it('accepts solid on its own', () => {
    expect(resolvePluginKeys(['solid'])).toEqual(['solid'])
  })

  it('rejects an unknown key', () => {
    expect(() => resolvePluginKeys(['nope' as 'solid'])).toThrow('unknown plugin key')
  })
})

describe('createDevframes', () => {
  it('mounts no devframe for dock-only keys', () => {
    expect(createDevframes(['solid'], {})).toEqual([])
  })
})

describe('registerPanelDocks', () => {
  it('registers Home first so the hub rail opens on the landing page', () => {
    const { ctx, docks } = fakeContext()
    registerPanelDocks(ctx, ['home'])
    expect(docks).toHaveLength(1)
    expect(docks[0]).toMatchObject({ id: 'home', title: 'Home', url: `${base}#/home` })
  })

  it('keeps Home ahead of every other panel', () => {
    const { ctx, docks } = fakeContext()
    registerPanelDocks(ctx, resolvePluginKeys('all'))
    expect(docks[0]?.id).toBe('home')
  })

  it('registers Solid in the framework category at #/solid', () => {
    const { ctx, docks } = fakeContext()
    registerPanelDocks(ctx, ['solid'])
    expect(docks).toHaveLength(1)
    expect(docks[0]).toMatchObject({ id: 'solid', title: 'Solid', url: `${base}#/solid`, category: 'framework' })
  })

  it('keeps Components and Routes in the project category', () => {
    const { ctx, docks } = fakeContext()
    registerPanelDocks(ctx, ['components', 'routes'])
    expect(docks.map((d) => [d.id, d.category])).toEqual([
      ['components', 'project'],
      ['routes', 'project'],
    ])
  })

  it('registers every roadmap panel at its matching hash route', () => {
    const { ctx, docks } = fakeContext()
    registerPanelDocks(ctx, resolvePluginKeys('all'))
    const panelIds = [
      'theme',
      'network',
      'runs',
      'mcp-playground',
      'performance',
      'console',
      'bundle',
      'env',
      'visual-diff',
      'tests',
      'state',
      'imports',
      'i18n',
      'security',
    ]
    expect(panelIds).toHaveLength(14)
    for (const id of panelIds) {
      expect(docks).toContainEqual(expect.objectContaining({ id, url: `${base}#/${id}` }))
    }
  })

  it('skips the panel when the host devframe is not mounted', () => {
    const { docks } = fakeContext()
    registerPanelDocks({ frames: [], docks: { register: (d: never) => docks.push(d) } } as unknown as DevframeHubContext, [
      'solid',
    ])
    expect(docks).toEqual([])
  })
})
