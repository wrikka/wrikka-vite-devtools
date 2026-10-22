import { describe, expect, it } from 'bun:test'
import { kindFromFile, parseRoute, pathFromFile } from '../src/rpc/routes'

describe('pathFromFile', () => {
  it('derives a path from the folder tail', () => {
    expect(pathFromFile('src/routes/about.tsx', 'src/routes')).toBe('/about')
  })

  it('maps an index file onto its parent path', () => {
    expect(pathFromFile('src/routes/blog/index.tsx', 'src/routes')).toBe('/blog')
    expect(pathFromFile('src/routes/index.tsx', 'src/routes')).toBe('/')
  })

  it('keeps the param token as written', () => {
    expect(pathFromFile('src/routes/posts.$postId.tsx', 'src/routes')).toBe('/posts/$postId')
  })

  it('ignores the private folder but keeps the file segment', () => {
    expect(pathFromFile('src/routes/-utils/helper.tsx', 'src/routes')).toBe('/helper')
  })
})

describe('kindFromFile', () => {
  it('spots the root and nested layouts', () => {
    expect(kindFromFile('src/routes/__root.tsx', '')).toBe('layout')
    expect(kindFromFile('src/routes/app.layout.tsx', '')).toBe('layout')
  })

  it('spots the not-found route', () => {
    expect(kindFromFile('src/routes/__404.tsx', '')).toBe('not-found')
  })

  it('calls index files index and everything else page', () => {
    expect(kindFromFile('src/routes/index.tsx', '')).toBe('index')
    expect(kindFromFile('src/routes/about.tsx', '')).toBe('page')
  })

  it('treats a route that declares children as a layout', () => {
    const text = 'const Route = createFileRoute("/app")({ children: [] })'
    expect(kindFromFile('src/routes/app.tsx', text)).toBe('layout')
  })
})

describe('parseRoute', () => {
  it('prefers the declared path and reports loader, ssr and params', () => {
    const text = `
      export const Route = createFileRoute('/posts/$postId')({
        loader: async () => null,
        ssr: false,
      })`
    const r = parseRoute('src/routes/posts.$postId.tsx', text, 'src/routes', false)
    expect(r.path).toBe('/posts/$postId')
    expect(r.hasLoader).toBe(true)
    expect(r.ssrOff).toBe(true)
    expect(r.hasHead).toBe(false)
    expect(r.params).toEqual(['postId'])
    expect(r.title).toBeUndefined()
    expect(r.generated).toBe(false)
  })

  it('reads a literal title and meta names from a head block', () => {
    const text = `createFileRoute('/dash')({ head: { meta: [{ title: 'Dashboard' }] } })`
    const r = parseRoute('src/routes/dash.tsx', text, 'src/routes', true)
    expect(r.hasHead).toBe(true)
    expect(r.title).toBe('Dashboard')
    expect(r.metaNames).toEqual([])
    expect(r.kind).toBe('page')
  })

  it('marks a head without a literal title as dynamic', () => {
    const text = `createFileRoute('/legal')({
      head: () => ({ meta: [{ name: 'description', content: 'Legal terms for the app' }] })
    })`
    const r = parseRoute('src/routes/legal.tsx', text, 'src/routes', true)
    expect(r.title).toBe('dynamic')
    expect(r.description).toBe('Legal terms for the app')
    expect(r.metaNames).toEqual(['description'])
  })

  it('falls back to the derived path when nothing is declared', () => {
    const r = parseRoute('src/routes/about.tsx', 'export default function About() { return null }', 'src/routes', true)
    expect(r.path).toBe('/about')
    expect(r.generated).toBe(true)
  })
})
