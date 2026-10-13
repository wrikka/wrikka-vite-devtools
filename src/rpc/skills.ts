import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { defineRpcFunction } from 'devframe'
import { z } from 'zod'

const SkillSchema = z.object({
  name: z.string(),
  description: z.string(),
  path: z.string(),
  root: z.string(),
})

const NAME_RE = /^name:\s*(.+)$/m
const DESC_RE = /^description:\s*(.+)$/m
const MAX_SKILLS = 400

export interface SkillsRpcDeps {
  roots: string[]
}

function frontmatterField(re: RegExp, raw: string): string {
  const match = re.exec(raw)
  return (match?.[1] ?? '').trim().replace(/^["']|["']$/g, '')
}

async function scanRoot(root: string, out: z.infer<typeof SkillSchema>[]): Promise<void> {
  let dirents
  try {
    dirents = await readdir(root, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of dirents) {
    if (out.length >= MAX_SKILLS) return
    if (!entry.isDirectory()) continue
    const skillFile = join(root, entry.name, 'SKILL.md')
    try {
      const raw = await readFile(skillFile, 'utf8')
      const front = raw.slice(0, raw.indexOf('\n---', 3) > 0 ? raw.indexOf('\n---', 3) + 4 : 1200)
      const name = frontmatterField(NAME_RE, front) || entry.name
      out.push({
        name,
        description: frontmatterField(DESC_RE, raw.slice(0, 4000)).slice(0, 300),
        path: skillFile,
        root,
      })
    } catch {
      /* no SKILL.md in this directory — skip */
    }
  }
}

export function createSkillsRpc(deps: SkillsRpcDeps) {
  const listSkills = defineRpcFunction({
    name: 'list-skills',
    type: 'query',
    jsonSerializable: true,
    args: [z.object({ roots: z.array(z.string()).optional() })],
    agent: { description: 'List harness skills (name + description) discoverable from the configured skill roots' },
    returns: z.object({ skills: z.array(SkillSchema), roots: z.array(z.string()) }),
    handler: async ({ roots }) => {
      const effective = roots && roots.length > 0 ? roots : deps.roots
      const skills: z.infer<typeof SkillSchema>[] = []
      for (const root of effective) await scanRoot(root, skills)
      return { skills, roots: effective }
    },
  })
  return { listSkills }
}
