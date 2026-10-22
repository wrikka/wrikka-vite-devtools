import { describe, expect, it } from 'bun:test'
import { exportedNames, kindOf } from '../src/rpc/components'

describe('exportedNames', () => {
  it('collects PascalCase function, const and default exports', () => {
    const src = `
      export function Button() {}
      export const Card = () => null
      export default function App() { return null }
      export class Dialog {}
      const ignored = 1
      `
    expect(exportedNames(src).sort()).toEqual(['App', 'Button', 'Card', 'Dialog'])
  })

  it('follows re-aliases and skips lowercase or default-keyword names', () => {
    expect(exportedNames('export { Link as NavLink, helpers, Nav as default }')).toEqual(['NavLink'])
  })

  it('dedupes a name exported twice', () => {
    expect(exportedNames('export const Chip = 1\nexport { Chip }')).toEqual(['Chip'])
  })

  it('returns nothing for a module without component exports', () => {
    expect(exportedNames('export const utils = {}\nexport function toArray(x) {}')).toEqual([])
  })
})

describe('kindOf', () => {
  it('calls use-prefixed exports hooks before anything else', () => {
    expect(kindOf('src/routes/useThing.ts', 'useThing')).toBe('hook')
  })

  it('calls exports inside a routes or pages folder pages', () => {
    expect(kindOf('src/routes/posts.tsx', 'Posts')).toBe('page')
    expect(kindOf('src/pages/index.tsx', 'Home')).toBe('page')
  })

  it('does not treat a folder merely ending in "routes" as a route folder', () => {
    expect(kindOf('src/myroutes/Panel.tsx', 'Panel')).toBe('component')
  })

  it('calls wrapper-shaped files layouts', () => {
    expect(kindOf('src/ui/AppShell.tsx', 'Shell')).toBe('layout')
  })

  it('falls back to component', () => {
    expect(kindOf('src/ui/Button.tsx', 'Button')).toBe('component')
  })
})
