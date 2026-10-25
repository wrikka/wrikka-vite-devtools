import { describe, expect, it } from 'bun:test'
import {
  collectOwners,
  matchesRow,
  ownerRows,
  previewValue,
  readSolidSetup,
  solidVersions,
  sourceRows,
  unownedSignals,
  type SolidOwnerLike,
  type SolidSetupLike,
} from '../src/client/solid'

const root: SolidOwnerLike = { name: 'App', componentName: 'App', value: () => {}, owned: [1, 2] }
const child: SolidOwnerLike = { name: 'effect-1', value: () => {}, owner: root, sources: [1] }
const leaf: SolidOwnerLike = { name: 'Counter', componentName: 'Counter', owner: child, sources: [1, 2, 3] }

describe('readSolidSetup', () => {
  it('returns undefined when the debugger setup never loaded', () => {
    expect(readSolidSetup({})).toBeUndefined()
  })

  it('ignores a non-object global', () => {
    expect(readSolidSetup({ SolidDevtools$$: true })).toBeUndefined()
  })

  it('returns the setup object when present', () => {
    const setup = { get_created_owners: () => [] }
    expect(readSolidSetup({ SolidDevtools$$: setup })).toBe(setup)
  })
})

describe('solidVersions', () => {
  it('prefers getter functions over fields', () => {
    const setup: SolidSetupLike = {
      versions: { solid: '1.8.0', client: '0.28.1', expected_solid: '1.9.0', get_solid: () => '1.9.16' },
    }
    expect(solidVersions(setup)).toEqual({ solid: '1.9.16', client: '0.28.1', expected: '1.9.0' })
  })

  it('reports unknown when the setup omits versions', () => {
    expect(solidVersions({})).toEqual({ solid: 'unknown', client: 'unknown', expected: 'unknown' })
  })
})

describe('collectOwners', () => {
  it('drops non-object entries and tolerates a missing getter', () => {
    expect(collectOwners({ get_created_owners: () => [root, null, 3] })).toEqual([root])
    expect(collectOwners({})).toEqual([])
  })

  it('returns an empty list when the getter throws', () => {
    const setup: SolidSetupLike = {
      get_created_owners: () => {
        throw new Error('detached')
      },
    }
    expect(collectOwners(setup)).toEqual([])
  })
})

describe('ownerRows', () => {
  it('derives depth from known owners only', () => {
    const rows = ownerRows([root, child, leaf])
    expect(rows.map((r) => r.depth)).toEqual([0, 1, 2])
  })

  it('classifies components, effects, and computations', () => {
    const rows = ownerRows([root, child, leaf, { name: 'memo-1', value: () => 1 }])
    expect(rows.map((r) => r.kind)).toEqual(['component', 'effect', 'component', 'computation'])
  })

  it('counts owned children and sources and previews the value', () => {
    const rows = ownerRows([root, child, leaf])
    expect(rows[0]).toMatchObject({ id: 'owner:0', name: 'App', owned: 2, sources: 0 })
    expect(rows[1]).toMatchObject({ name: 'effect-1', owned: 0, sources: 1 })
    expect(rows[2]!.preview).toBe('undefined')
  })

  it('falls back to a positional name', () => {
    expect(ownerRows([{}])[0]!.name).toBe('#0')
  })
})

describe('previewValue', () => {
  it('formats primitives, functions, arrays, and long strings', () => {
    expect(previewValue(null)).toBe('null')
    expect(previewValue('hi')).toBe('"hi"')
    expect(previewValue(42)).toBe('42')
    expect(previewValue(() => {})).toBe('ƒ anonymous')
    expect(previewValue([1, 2])).toBe('[2 items]')
    expect(previewValue('x'.repeat(80)).endsWith('…"')).toBe(true)
  })

  it('serializes objects and survives cycles', () => {
    expect(previewValue({ a: 1 })).toBe('{"a":1}')
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    expect(previewValue(cyclic)).toBe('Object')
  })
})

describe('unownedSignals', () => {
  it('dereferences live weak refs and skips dead ones', () => {
    const setup: SolidSetupLike = {
      unowned: { signals: [new WeakRef({ name: 'count', value: 3 }), new WeakRef({}), undefined] },
    }
    expect(unownedSignals(setup)).toEqual([
      { name: 'count', preview: '3' },
      { name: '(unnamed)', preview: 'undefined' },
    ])
  })

  it('returns an empty list when the setup has no unowned group', () => {
    expect(unownedSignals({})).toEqual([])
  })

  it('honours the limit', () => {
    const setup: SolidSetupLike = { unowned: { signals: Array.from({ length: 5 }, (_, i) => new WeakRef({ name: `s${i}` })) } }
    expect(unownedSignals(setup, 2).map((s) => s.name)).toEqual(['s0', 's1'])
  })
})

describe('sourceRows', () => {
  it('maps recorded sources and falls back to a positional name', () => {
    expect(sourceRows(leaf)).toEqual([
      { name: 'source#0', preview: 'undefined' },
      { name: 'source#1', preview: 'undefined' },
      { name: 'source#2', preview: 'undefined' },
    ])
  })

  it('returns an empty list for an owner without sources', () => {
    expect(sourceRows(root)).toEqual([])
    expect(sourceRows(undefined)).toEqual([])
  })
})

describe('matchesRow', () => {
  const row = ownerRows([leaf])[0]!

  it('matches everything on an empty query', () => {
    expect(matchesRow(row, '   ')).toBe(true)
  })

  it('matches the name case-insensitively and the kind', () => {
    expect(matchesRow(row, 'COUN')).toBe(true)
    expect(matchesRow(row, 'component')).toBe(true)
    expect(matchesRow(row, 'effect')).toBe(false)
  })
})
