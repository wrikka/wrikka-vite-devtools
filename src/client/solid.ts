/**
 * Read-only view over the `@solid-devtools/debugger/setup` global.
 * The package is optional, so nothing here imports it — the shapes below are
 * structural subsets of its `SetupApi` and Solid's DEV `Owner`.
 */

export interface SolidOwnerLike {
  name?: string
  componentName?: string
  type?: string | number
  owner?: SolidOwnerLike | null
  owned?: unknown[] | null
  sources?: unknown[] | null
  value?: unknown
}

export interface SolidVersionsLike {
  solid?: string | (() => string) | null
  client?: string | (() => string) | null
  expected_solid?: string | (() => string) | null
  get_solid?: () => string | null
  get_client?: () => string | null
  get_expected_solid?: () => string | null
}

export interface SolidSetupLike {
  get_created_owners?: () => unknown[]
  versions?: SolidVersionsLike
  unowned?: { signals?: (WeakRef<object> | undefined)[] }
}

export interface OwnerRow {
  id: string
  name: string
  kind: 'component' | 'computation' | 'effect' | 'owner'
  depth: number
  owned: number
  sources: number
  preview: string
  owner?: SolidOwnerLike
}

export interface SignalRow {
  name: string
  preview: string
}

/** The setup global is only present when the host app imported the debugger setup. */
export function readSolidSetup(scope: unknown = globalThis): SolidSetupLike | undefined {
  const setup = (scope as { SolidDevtools$$?: unknown } | null)?.SolidDevtools$$
  return setup && typeof setup === 'object' ? (setup as SolidSetupLike) : undefined
}

/** `versions` in the setup API mixes plain fields with getter functions. */
function versionValue(...candidates: unknown[]): string {
  for (const candidate of candidates) {
    let value: unknown = candidate
    if (typeof candidate === 'function') {
      try {
        value = (candidate as () => unknown)()
      } catch {
        continue
      }
    }
    if (typeof value === 'string' && value) return value
  }
  return 'unknown'
}

export function solidVersions(setup: SolidSetupLike): { solid: string; client: string; expected: string } {
  const v = setup.versions
  return {
    solid: versionValue(v?.get_solid, v?.solid),
    client: versionValue(v?.get_client, v?.client),
    expected: versionValue(v?.get_expected_solid, v?.expected_solid),
  }
}

/** Owners created by the app, newest last. A throwing getter must not break the panel. */
export function collectOwners(setup: SolidSetupLike): SolidOwnerLike[] {
  try {
    const owners = setup.get_created_owners?.()
    return Array.isArray(owners) ? owners.filter((o): o is SolidOwnerLike => !!o && typeof o === 'object') : []
  } catch {
    return []
  }
}

function listLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0
}

function kindOf(owner: SolidOwnerLike): OwnerRow['kind'] {
  if (typeof owner.componentName === 'string' && owner.componentName) return 'component'
  if (typeof owner.name === 'string' && owner.name.startsWith('effect')) return 'effect'
  if (typeof owner.value === 'function') return 'computation'
  return 'owner'
}

function nameOf(owner: SolidOwnerLike, index: number): string {
  const name = owner.componentName || owner.name
  return typeof name === 'string' && name ? name : `#${index}`
}

/** Bounded depth: Solid's owner chain can be long and cyclic-safe is not guaranteed. */
function depthOf(owner: SolidOwnerLike, all: Set<SolidOwnerLike>): number {
  let depth = 0
  let cursor = owner.owner
  while (cursor && all.has(cursor) && depth < 32) {
    depth += 1
    cursor = cursor.owner
  }
  return depth
}

export function previewValue(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'function') return `ƒ ${value.name || 'anonymous'}`
  if (typeof value === 'string') return value.length > 60 ? `"${value.slice(0, 57)}…"` : `"${value}"`
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value)
  if (Array.isArray(value)) return `[${value.length} item${value.length === 1 ? '' : 's'}]`
  try {
    const json = JSON.stringify(value)
    if (!json) return typeof value
    return json.length > 80 ? `${json.slice(0, 77)}…` : json
  } catch {
    return Object.prototype.toString.call(value).slice(8, -1)
  }
}

export function ownerRows(owners: SolidOwnerLike[]): OwnerRow[] {
  const set = new Set(owners)
  return owners.map((owner, index) => ({
    id: `owner:${index}`,
    name: nameOf(owner, index),
    kind: kindOf(owner),
    depth: depthOf(owner, set),
    owned: listLength(owner.owned),
    sources: listLength(owner.sources),
    preview: previewValue(owner.value),
    owner,
  }))
}

/** Signals not owned by any computation — the app's top-level `createSignal` calls. */
export function unownedSignals(setup: SolidSetupLike, limit = 100): SignalRow[] {
  const refs = setup.unowned?.signals
  if (!Array.isArray(refs)) return []
  const rows: SignalRow[] = []
  for (const ref of refs.slice(0, limit)) {
    const signal = ref?.deref() as { name?: unknown; value?: unknown } | undefined
    if (!signal || typeof signal !== 'object') continue
    rows.push({
      name: typeof signal.name === 'string' && signal.name ? signal.name : '(unnamed)',
      preview: previewValue(signal.value),
    })
  }
  return rows
}

/** The signals and memos this owner read during its last run. */
export function sourceRows(owner: SolidOwnerLike | undefined, limit = 50): SignalRow[] {
  const sources = owner?.sources
  if (!Array.isArray(sources)) return []
  return sources.slice(0, limit).map((source, index) => {
    const ref = source as { name?: unknown; value?: unknown } | undefined
    return {
      name: typeof ref?.name === 'string' && ref.name ? ref.name : `source#${index}`,
      preview: previewValue(ref?.value),
    }
  })
}

export function matchesRow(row: OwnerRow, needle: string): boolean {
  const q = needle.trim().toLowerCase()
  return !q || row.name.toLowerCase().includes(q) || row.kind.includes(q)
}

export const SOLID_INSTALL_STEPS = [
  'bun add -d @solid-devtools/debugger',
  "import '@solid-devtools/debugger/setup' at the top of your app entry, before render(...)",
  'reload this page',
] as const
