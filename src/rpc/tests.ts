import { spawn } from 'node:child_process'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { defineRpcFunction } from 'devframe'
import { z } from 'zod'
import { projectRoot } from './context'
import { assertCan } from './access'
import { CODE_EXT, isInside, scanSource } from './scan'

const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/
const SOURCE_EXT = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte', '.astro']
const RUN_TIMEOUT = 120_000
const OUTPUT_CAP = 20_000

/** `src/a/b.test.ts` pairs with `src/a/b.ts` (any source extension). */
export function testBase(file: string): string {
  return file.replace(TEST_FILE, '').replace(/\.[a-z]+$/, '')
}

export function matchSources(testFile: string, sources: string[]): string[] {
  const base = testBase(testFile)
  return sources.filter((s) => s === base || s.replace(/\.[a-z]+$/, '') === base)
}

async function exists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}

async function pickRunner(root: string, file: string): Promise<{ label: string; bin: string; args: string[] }> {
  if (process.versions.bun) return { label: 'bun test', bin: process.execPath, args: ['test', file] }
  const vitest = join(root, 'node_modules', 'vitest', 'vitest.mjs')
  if (await exists(vitest)) return { label: 'vitest', bin: process.execPath, args: [vitest, 'run', file] }
  const jest = join(root, 'node_modules', 'jest', 'bin', 'jest.js')
  if (await exists(jest)) return { label: 'jest', bin: process.execPath, args: [jest, '--runTestsByPath', file] }
  return { label: 'node --test', bin: process.execPath, args: ['--test', file] }
}

export const listTests = defineRpcFunction({
  name: 'list-tests',
  type: 'query',
  agent: {
    description: 'Find test files and the source file each one covers, plus source files that have no adjacent test',
  },
  args: [z.object({ dir: z.string().optional() })],
  returns: z.object({
    root: z.string(),
    tests: z.array(z.object({ file: z.string(), matches: z.array(z.string()) })),
    untested: z.array(z.string()),
    runner: z.string(),
  }),
  handler: async ({ dir } = {}) => {
    const root = projectRoot()
    const scan = await scanSource({ dir, exts: new Set([...CODE_EXT]) })
    const sources = scan.files.filter((f) => !TEST_FILE.test(f.rel) && !f.rel.endsWith('.d.ts')).map((f) => f.rel)
    const tests = scan.files.filter((f) => TEST_FILE.test(f.rel))
    const covered = new Set(tests.flatMap((t) => matchSources(t.rel, sources)))
    const bun = Boolean(process.versions.bun)
    const runner = bun ? 'bun test' : (await exists(join(root, 'node_modules', 'vitest', 'vitest.mjs'))) ? 'vitest' : 'node --test'

    return {
      root: scan.dir,
      tests: tests.map((t) => ({ file: t.rel, matches: matchSources(t.rel, sources).slice(0, 4) })),
      untested: sources
        .filter((s) => !covered.has(s) && /\.[jt]sx?$/.test(s) && !/\.config\./.test(s))
        .slice(0, 100),
      runner,
    }
  },
})

export const runTest = defineRpcFunction({
  name: 'run-test',
  type: 'action',
  agent: {
    description: 'Run a single test file with the project runner (bun test / vitest / jest / node --test) and return its output',
  },
  args: [z.object({ file: z.string() })],
  returns: z.object({
    file: z.string(),
    runner: z.string(),
    ok: z.boolean(),
    code: z.number(),
    durationMs: z.number(),
    output: z.string(),
  }),
  handler: async ({ file }) => {
    assertCan('test:run')
    const root = projectRoot()
    const full = join(root, file)
    if (!isInside(root, full) || !TEST_FILE.test(file)) throw new Error('only test files inside the project can run')
    if (!(await exists(full))) throw new Error(`${file} does not exist`)

    const runner = await pickRunner(root, full)
    const started = Date.now()
    return await new Promise((resolve) => {
      const child = spawn(runner.bin, runner.args, { cwd: root, env: process.env, windowsHide: true })
      let output = ''
      const append = (chunk: Buffer): void => {
        output += chunk.toString('utf8')
        if (output.length > OUTPUT_CAP * 2) output = output.slice(-OUTPUT_CAP)
      }
      child.stdout.on('data', append)
      child.stderr.on('data', append)
      const timer = setTimeout(() => {
        child.kill()
        output += `\n[timed out after ${RUN_TIMEOUT / 1000}s]`
      }, RUN_TIMEOUT)
      child.on('error', (err) => {
        clearTimeout(timer)
        resolve({ file, runner: runner.label, ok: false, code: -1, durationMs: Date.now() - started, output: String(err) })
      })
      child.on('close', (code) => {
        clearTimeout(timer)
        resolve({
          file,
          runner: runner.label,
          ok: code === 0,
          code: code ?? -1,
          durationMs: Date.now() - started,
          output: output.slice(-OUTPUT_CAP),
        })
      })
    })
  },
})

export const SOURCE_EXTENSIONS = SOURCE_EXT
