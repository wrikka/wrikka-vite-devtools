export interface StorageEntry {
  key: string
  type: string
  length: number
}

export interface StorageChange {
  key: string
  kind: 'added' | 'removed' | 'changed'
  from: string
  to: string
}

export function storageEntries(data: Record<string, unknown>, field: string): StorageEntry[] {
  const raw = data[field]
  if (!Array.isArray(raw)) return []
  const out: StorageEntry[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const key = typeof rec.key === 'string' ? rec.key : ''
    if (!key) continue
    out.push({
      key,
      type: typeof rec.type === 'string' ? rec.type : 'text',
      length: typeof rec.length === 'number' ? rec.length : 0,
    })
  }
  return out
}

function describe(entry: StorageEntry): string {
  return `${entry.type} · ${entry.length} chars`
}

/** Compare storage key metadata without reading any stored value. */
export function diffStorage(before: StorageEntry[], after: StorageEntry[]): StorageChange[] {
  const left = new Map(before.map((entry) => [entry.key, entry]))
  const right = new Map(after.map((entry) => [entry.key, entry]))
  const out: StorageChange[] = []
  for (const [key, entry] of right) {
    const prev = left.get(key)
    if (!prev) out.push({ key, kind: 'added', from: '—', to: describe(entry) })
    else if (prev.length !== entry.length || prev.type !== entry.type) {
      out.push({ key, kind: 'changed', from: describe(prev), to: describe(entry) })
    }
  }
  for (const [key, entry] of left) {
    if (!right.has(key)) out.push({ key, kind: 'removed', from: describe(entry), to: '—' })
  }
  return out.sort((a, b) => a.key.localeCompare(b.key))
}
