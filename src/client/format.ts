export function fmtBytes(bytes: number | undefined): string {
  if (bytes == null || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export function fmtMs(ms: number | undefined): string {
  if (ms == null) return '—'
  if (ms < 1) return '<1 ms'
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

export function fmtWhen(iso: string | number | undefined): string {
  if (iso == null) return '—'
  const date = typeof iso === 'number' ? new Date(iso) : new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const diff = Date.now() - date.getTime()
  if (diff < 60_000) return `${Math.max(0, Math.round(diff / 1000))}s ago`
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`
  return date.toLocaleDateString()
}

export function pct(part: number, total: number): string {
  if (total <= 0) return '0%'
  return `${Math.round((part / total) * 100)}%`
}

/** Runtime utilities are dot-paths in some payloads; keep short labels readable. */
export function shortPath(file: string, keep = 2): string {
  const parts = file.split('/')
  return parts.slice(-keep).join('/')
}
