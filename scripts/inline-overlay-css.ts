import { globSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

// Fold the emitted UnoCSS/base stylesheet into the overlay bundle so the
// dock page-script stays a single self-contained file. The host template
// only rewrites the entry specifier — a sibling .css asset would 404.
const dir = fileURLToPath(new URL('../dist/overlay/', import.meta.url))
const files = globSync('*.css', { cwd: dir })
if (files.length !== 1) exit(`expected exactly 1 css asset, found ${files.length}: ${files.join(', ')}`)

const cssPath = join(dir, files[0]!)
const jsPath = join(dir, 'index.mjs')
// @property is ignored inside shadow roots, so presetWind4's colour/shadow
// utilities (color-mix with var(--un-*)) resolve to nothing there. Rewrite
// each registration into a universal fallback declaration instead.
function shadowDomSafe(css: string): string {
  const fallbacks: string[] = []
  const stripped = css.replace(/@property\s+(--[\w-]+)\s*\{([^}]*)\}/g, (_m, name: string, body: string) => {
    const initial = /initial-value:([^;}]+)/.exec(body)?.[1]?.trim()
    if (initial) fallbacks.push(`${name}:${initial}`)
    return ''
  })
  if (fallbacks.length === 0) return stripped
  return `*,::before,::after{${fallbacks.join(';')}}${stripped}`
}

const css = shadowDomSafe(readFileSync(cssPath, 'utf8'))
const js = readFileSync(jsPath, 'utf8')

const quoted = /(["'])__OVERLAY_CSS_TOKEN__\1/
const matches = js.match(new RegExp(quoted.source, 'g'))
if (!matches || matches.length !== 1) exit(`css token found ${matches?.length ?? 0} times in index.mjs, expected 1`)

writeFileSync(jsPath, js.replace(quoted, () => JSON.stringify(css)))
rmSync(cssPath)
console.log(`[inline-overlay-css] inlined ${css.length} bytes of CSS into index.mjs`)

function exit(message: string): never {
  console.error(`[inline-overlay-css] ${message}`)
  process.exit(1)
}
