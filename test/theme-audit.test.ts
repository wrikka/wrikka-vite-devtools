import { afterAll, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { projectContext } from '../src/rpc/context'
import {
  arbitraryIsColor,
  classifyColorUtility,
  flattenObjectKeys,
  paletteModules,
  themeTokens,
} from '../src/rpc/theme-audit'
import type { SourceFile } from '../src/rpc/scan'

const TOKENS = new Set(['surface', 'surface-raised', 'ink', 'ink-muted', 'accent', 'accent-soft'])

describe('flattenObjectKeys', () => {
  it('flattens DEFAULT and nested keys into utility names', () => {
    expect(flattenObjectKeys("surface: { DEFAULT: '#000', raised: '#111' }, ink: '#fff'")).toEqual([
      'surface',
      'surface-raised',
      'ink',
    ])
  })
})

describe('arbitraryIsColor', () => {
  it('rejects size and numeric values', () => {
    for (const value of ['[13px]', '[1.5rem]', '[100%]', '[length:3px]', '[0]']) {
      expect(arbitraryIsColor(value)).toBe(false)
    }
  })

  it('accepts hex, color functions, and bare color words', () => {
    for (const value of ['[#fff]', '[rgb(0_0_0)]', '[color:oklch(0.5_0.1_20)]', '[red]']) {
      expect(arbitraryIsColor(value)).toBe(true)
    }
  })
})

describe('classifyColorUtility', () => {
  it('classifies theme tokens, palette hardcodes, and sizes', () => {
    expect(classifyColorUtility('bg-surface-raised/60', TOKENS)?.kind).toBe('token')
    expect(classifyColorUtility('hover:text-ink-muted', TOKENS)?.kind).toBe('token')
    expect(classifyColorUtility('bg-blue-500', TOKENS)?.kind).toBe('palette')
    expect(classifyColorUtility('text-[13px]', TOKENS)).toBeUndefined()
  })

  it('ignores gradient direction utilities', () => {
    expect(classifyColorUtility('bg-linear-to-br', TOKENS)).toBeUndefined()
    expect(classifyColorUtility('bg-radial', TOKENS)).toBeUndefined()
    expect(classifyColorUtility('bg-gradient-to-r', TOKENS)).toBeUndefined()
  })

  it('flags dark: variants and arbitrary colors', () => {
    expect(classifyColorUtility('dark:bg-surface', TOKENS)).toEqual({ kind: 'token', dark: true })
    expect(classifyColorUtility('text-[#ff0000]', TOKENS)?.kind).toBe('arbitrary')
  })

  it('leaves non-color utilities alone', () => {
    expect(classifyColorUtility('text-sm', TOKENS)).toBeUndefined()
    expect(classifyColorUtility('border-solid', TOKENS)).toBeUndefined()
    expect(classifyColorUtility('flex', TOKENS)).toBeUndefined()
  })
})

describe('themeTokens', () => {
  const file = (text: string): SourceFile => ({ rel: 'theme.ts', full: '/tmp/theme.ts', text })

  it('reads a themeColors object and CSS custom properties', () => {
    const tokens = themeTokens([
      file("export const themeColors: Record<string, unknown> = { surface: { DEFAULT: '#000' }, ink: '#fff' }"),
      file(':root { --color-line: #222; }'),
    ])
    expect(tokens).toEqual(['ink', 'line', 'surface'])
  })
})

describe('paletteModules', () => {
  const dir = join(tmpdir(), `wrikka-palette-${process.pid}`)
  const previous = projectContext.root

  afterAll(async () => {
    projectContext.root = previous
    await rm(dir, { recursive: true, force: true })
  })

  it('follows a relative palette import and skips package specifiers', async () => {
    await mkdir(join(dir, 'src'), { recursive: true })
    await writeFile(
      join(dir, 'src', 'theme.ts'),
      "export const themeColors = { surface: { DEFAULT: '#000' }, ink: '#fff' }",
    )
    await writeFile(
      join(dir, 'src', 'uno.config.ts'),
      "import { themeColors } from './theme'\nimport { presetWind4 } from 'unocss'\nexport default { theme: { colors: themeColors } }",
    )
    projectContext.root = dir

    const config: SourceFile = {
      rel: 'src/uno.config.ts',
      full: join(dir, 'src', 'uno.config.ts'),
      text: await Bun.file(join(dir, 'src', 'uno.config.ts')).text(),
    }
    const extra = await paletteModules([config])

    expect(extra.map((f) => f.rel)).toEqual(['src/theme.ts'])
    expect(themeTokens([config, ...extra])).toEqual(['ink', 'surface'])
  })
})
