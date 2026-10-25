import { relative, sep } from 'node:path'
import { gzipSync } from 'node:zlib'
import { defineRpcFunction } from 'devframe'
import { z } from 'zod'
import { projectContext, projectRoot } from './context'

interface GraphNode {
  id?: string | null
  file?: string | null
  importedModules?: Set<GraphNode>
  transformResult?: { code?: string } | null
}

interface Graph {
  idToModuleMap: Map<string, GraphNode>
}

function clientGraph(): Graph | undefined {
  const server = projectContext.server as any
  return (server?.environments?.client?.moduleGraph ?? server?.moduleGraph) as Graph | undefined
}

function cleanId(id: string): string {
  return id.split('?')[0]!
}

/** DFS over project-local modules; returns import cycles up to `limit`. */
export function findCycles(local: Map<string, GraphNode>, limit = 8): string[][] {
  const cycles: string[][] = []
  const state = new Map<string, 0 | 1 | 2>()
  const stack: string[] = []

  function visit(id: string): void {
    if (cycles.length >= limit) return
    const mark = state.get(id) ?? 0
    if (mark === 1) {
      const at = stack.indexOf(id)
      if (at >= 0) cycles.push([...stack.slice(at), id])
      return
    }
    if (mark === 2) return
    state.set(id, 1)
    stack.push(id)
    for (const child of local.get(id)?.importedModules ?? []) {
      const childId = child.id ? cleanId(child.id) : ''
      if (childId && local.has(childId)) visit(childId)
      if (cycles.length >= limit) break
    }
    stack.pop()
    state.set(id, 2)
  }

  for (const id of local.keys()) visit(id)
  return cycles
}

export const auditBundle = defineRpcFunction({
  name: 'audit-bundle',
  type: 'query',
  agent: {
    description:
      'Inspect the live Vite client module graph: largest transformed modules with estimated gzip size, project-local vs dependency split, and import cycles among local modules',
  },
  args: [z.object({})],
  returns: z.object({
    available: z.boolean(),
    reason: z.string().optional(),
    modules: z.number(),
    total: z.number(),
    localBytes: z.number(),
    depBytes: z.number(),
    top: z.array(z.object({ file: z.string(), size: z.number(), gzip: z.number().optional(), local: z.boolean() })),
    cycles: z.array(z.array(z.string())),
  }),
  handler: async () => {
    const graph = clientGraph()
    if (!graph) {
      return {
        available: false,
        reason: 'dev server module graph is unavailable — start the hub with `vite` (not a static build)',
        modules: 0,
        total: 0,
        localBytes: 0,
        depBytes: 0,
        top: [],
        cycles: [],
      }
    }

    const root = projectRoot()
    const rows: { file: string; size: number; gzip?: number; local: boolean; id: string }[] = []
    const local = new Map<string, GraphNode>()
    let localBytes = 0
    let depBytes = 0

    for (const [id, node] of graph.idToModuleMap) {
      const clean = cleanId(id)
      const code = node.transformResult?.code
      if (!code) continue
      const size = Buffer.byteLength(code, 'utf8')
      const isLocal = !clean.includes('/node_modules/')
      if (isLocal) {
        local.set(clean, node)
        localBytes += size
      } else {
        depBytes += size
      }
      const file = isLocal ? relative(root, clean).split(sep).join('/') : clean.replace(/^.*\/node_modules\//, '')
      rows.push({ file, size, local: isLocal, id: clean })
    }

    rows.sort((a, b) => b.size - a.size)
    const top = rows.slice(0, 40).map((row) => {
      let gzip: number | undefined
      try {
        const code = graph.idToModuleMap.get(row.id)?.transformResult?.code
        if (code && code.length <= 2 * 1024 * 1024) gzip = gzipSync(Buffer.from(code, 'utf8')).length
      } catch {
        /* gzip is a nice-to-have estimate */
      }
      return { file: row.file, size: row.size, gzip, local: row.local }
    })

    const cycles = findCycles(local).map((cycle) =>
      cycle.map((id) => (id.includes('/node_modules/') ? id.replace(/^.*\/node_modules\//, '') : relative(root, id).split(sep).join('/'))),
    )

    return {
      available: true,
      modules: rows.length,
      total: localBytes + depBytes,
      localBytes,
      depBytes,
      top,
      cycles,
    }
  },
})
