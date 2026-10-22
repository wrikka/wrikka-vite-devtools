import { describe, expect, it } from 'bun:test'
import { assertLocalOrigin, decodeEntities, judge, metaByPrefix } from '../src/rpc/seo'
import type { SeoRow } from '../src/rpc/seo'

const clean = {
  path: '/',
  url: 'http://localhost:5173/',
  status: 200,
  title: 'Buuyook — wholesale sourcing',
  description: 'Source wholesale products from verified suppliers and track every order in one place.',
  og: { title: 'Buuyook', image: '/og.png' },
  twitter: { card: 'summary_large_image' },
  canonical: 'http://localhost:5173/',
  lang: 'en',
  h1: 1,
  bytes: 12_000,
  ms: 40,
}

describe('assertLocalOrigin', () => {
  it('accepts the loopback hosts a dev server binds to', () => {
    for (const origin of ['http://localhost:5173', 'http://127.0.0.1:3000', 'http://[::1]:5173']) {
      expect(assertLocalOrigin(origin).origin).toBe(origin.replace(/\/$/, ''))
    }
  })

  it('refuses to fetch anything that is not this machine', () => {
    expect(() => assertLocalOrigin('https://example.com')).toThrow(/not a local dev origin/)
    expect(() => assertLocalOrigin('http://10.0.0.5:5173')).toThrow(/not a local dev origin/)
  })

  it('refuses a non-http protocol', () => {
    expect(() => assertLocalOrigin('ftp://localhost/pub')).toThrow(/must be http\(s\)/)
  })

  it('refuses a value that is not a url at all', () => {
    expect(() => assertLocalOrigin('localhost:5173')).toThrow()
  })
})

describe('decodeEntities', () => {
  it('unescapes the entities meta content usually carries', () => {
    expect(decodeEntities('Tom &amp; Jerry &#39;live&#39; &quot;now&quot; &lt;beta&gt;')).toBe(
      `Tom & Jerry 'live' "now" <beta>`,
    )
  })

  it('trims surrounding whitespace', () => {
    expect(decodeEntities('  spaced  ')).toBe('spaced')
  })
})

describe('metaByPrefix', () => {
  const head = `
    <meta property="og:title" content="Hi &amp; bye">
    <meta property="og:image" content="/og.png">
    <meta name="twitter:card" content="summary">
    <meta name="viewport" content="width=device-width">
  `

  it('returns the keys under one prefix only', () => {
    expect(metaByPrefix(head, 'og')).toEqual({ title: 'Hi & bye', image: '/og.png' })
    expect(metaByPrefix(head, 'twitter')).toEqual({ card: 'summary' })
  })

  it('ignores name-keyed tags that do not carry the prefix', () => {
    expect(metaByPrefix(head, 'viewport')).toEqual({})
  })

  it('skips a tag with no content attribute', () => {
    expect(metaByPrefix('<meta property="og:description">', 'og')).toEqual({})
  })
})

describe('judge', () => {
  it('passes a fully described page', () => {
    expect(judge(clean)).toEqual([])
  })

  it('reports a failed fetch and missing head as bad', () => {
    const whats = judge({
      ...clean,
      status: 404,
      title: undefined,
      description: undefined,
    }).map((i) => i.what)
    expect(whats).toContain('http 404')
    expect(whats).toContain('no <title>')
    expect(whats).toContain('no meta description')
  })

  it('flags a timeout as a bad status', () => {
    expect(judge({ ...clean, status: -1 }).some((i) => i.level === 'bad')).toBe(true)
  })

  it('warns on lengths outside the recommended ranges', () => {
    expect(judge({ ...clean, title: 'Too short' })).toContainEqual({ level: 'warn', what: 'title too short (9)' })
    expect(judge({ ...clean, title: 'x'.repeat(61) })).toContainEqual({ level: 'warn', what: 'title too long (61)' })
    expect(judge({ ...clean, description: 'short' })).toContainEqual({ level: 'warn', what: 'description too short (5)' })
  })

  it('warns on missing social and structure signals', () => {
    const whats = judge({
      ...clean,
      og: {},
      twitter: {},
      canonical: undefined,
      lang: undefined,
      h1: 0,
    }).map((i) => i.what)
    expect(whats).toEqual([
      'no og:image',
      'no og:title',
      'no twitter:card',
      'no canonical link',
      'html has no lang attribute',
      'no h1 in the served html',
    ])
  })

  it('warns when a page serves several h1s', () => {
    expect(judge({ ...clean, h1: 3 })).toContainEqual({ level: 'warn', what: '3 h1 elements' })
  })

  it('returns rows shaped for the panel', () => {
    const row: SeoRow = { ...clean, issues: judge(clean) }
    expect(row.issues).toEqual([])
  })
})
