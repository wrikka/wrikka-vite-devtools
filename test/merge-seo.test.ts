import { describe, expect, it } from 'bun:test'
import { mergeSeo } from '../src/client/mergeSeo'
import type { RouteRow } from '../src/rpc/routes'
import type { SeoRow } from '../src/rpc/seo'

function route(path: string, params: string[] = []): RouteRow {
  return {
    file: `src/routes${path === '/' ? '/index' : path}.tsx`,
    path,
    kind: 'page',
    hasLoader: false,
    hasHead: false,
    ssrOff: false,
    params,
    metaNames: [],
    generated: true,
  }
}

function served(path: string): SeoRow {
  return {
    path,
    url: `http://localhost:5173${path}`,
    status: 200,
    og: {},
    twitter: {},
    h1: 1,
    bytes: 100,
    ms: 5,
    issues: [],
  }
}

describe('mergeSeo', () => {
  it('keys an audit row onto the route with the same path', () => {
    const map = mergeSeo([route('/about')], [served('/about')])
    expect([...map.keys()]).toEqual(['/about'])
  })

  it('ignores a trailing slash on either side', () => {
    const map = mergeSeo([route('/blog/')], [served('/blog')])
    expect(map.get('/blog/')).toBeTruthy()
  })

  it('matches the index route at the root', () => {
    const map = mergeSeo([route('/')], [served('/')])
    expect(map.has('/')).toBe(true)
  })

  it('never attaches html to a route that takes params', () => {
    const map = mergeSeo([route('/posts/$postId', ['postId'])], [served('/posts/$postId')])
    expect(map.size).toBe(0)
  })

  it('drops rows the source scan does not know about', () => {
    const map = mergeSeo([route('/about')], [served('/about'), served('/ghost')])
    expect([...map.keys()]).toEqual(['/about'])
  })

  it('returns an empty map before the first audit', () => {
    expect(mergeSeo([route('/about')], []).size).toBe(0)
  })
})
