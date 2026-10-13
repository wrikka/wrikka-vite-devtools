import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Comment } from './protocol'

export type SyncSink = (items: Comment[]) => void

const MAX_ITEMS = 200

/**
 * Node-side source of truth for comments: an in-memory list mirrored to a
 * devframe shared state (via `onSync`) and persisted to `comments.json` under
 * the devframe project storage dir.
 */
export class CommentStore {
  private items: Comment[] = []
  private sinks: SyncSink[] = []
  private writeTimer: NodeJS.Timeout | undefined
  private writing: Promise<void> = Promise.resolve()
  readonly file: string

  constructor(dir: string) {
    this.file = join(dir, 'comments.json')
  }

  async load(): Promise<void> {
    try {
      const raw = await readFile(this.file, 'utf8')
      const parsed = JSON.parse(raw) as { items?: unknown }
      if (Array.isArray(parsed.items)) {
        this.items = parsed.items as Comment[]
      }
    } catch {
      this.items = []
    }
  }

  onSync(sink: SyncSink): void {
    this.sinks.push(sink)
    sink(this.all())
  }

  all(): Comment[] {
    return [...this.items]
  }

  get(id: string): Comment | undefined {
    return this.items.find((c) => c.id === id)
  }

  add(comment: Comment): Comment {
    this.items.unshift(comment)
    if (this.items.length > MAX_ITEMS) this.items.length = MAX_ITEMS
    this.emit()
    return comment
  }

  update(id: string, patch: Partial<Comment>): Comment | undefined {
    const current = this.items.find((c) => c.id === id)
    if (!current) return undefined
    Object.assign(current, patch)
    this.emit()
    return current
  }

  private emit(): void {
    const snapshot = this.all()
    for (const sink of this.sinks) sink(snapshot)
    this.schedulePersist(snapshot)
  }

  private schedulePersist(snapshot: Comment[]): void {
    if (this.writeTimer) clearTimeout(this.writeTimer)
    this.writeTimer = setTimeout(() => {
      this.writeTimer = undefined
      this.writing = this.writing
        .catch(() => undefined)
        .then(async () => {
          await mkdir(join(this.file, '..'), { recursive: true })
          await writeFile(this.file, JSON.stringify({ items: snapshot }, null, 2))
        })
        .catch(() => undefined)
    }, 250)
    this.writeTimer.unref?.()
  }
}
