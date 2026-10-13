export interface ElementInfo {
  framework?: string
  componentLabel?: string
  tagName: string
  cssPath: string
  textPreview: string
  attributes: string
}

type AnyEl = HTMLElement & Record<string, unknown>

const GLOBAL_MARKERS: [string, RegExp][] = [
  ['nuxt', /__NUXT__/],
  ['next', /__NEXT_DATA__/],
  ['svelte', /__SVELTEKIT(?:_DEV|_EVENTS|_APP)__/],
  ['vue', /__VUE__/],
  ['react', /__REACT(?:_REFRESH__?|HOT)_/],
]

export function globalFramework(): string {
  const w = globalThis as Record<string, unknown>
  if (w.__NUXT__) return 'nuxt'
  if (w.__NEXT_DATA__) return 'react'
  if (w.$app || w.__SVELTEKIT_DEV__) return 'svelte'
  for (const [name, re] of GLOBAL_MARKERS) if (Object.keys(w).some((k) => re.test(k))) return name
  return 'unknown'
}

/** Walk framework internals from `start` upward until a named component is found. */
function componentOf(start: HTMLElement): { framework: string; label: string } | undefined {
  const marks = Object.getOwnPropertyNames(start)
  const fiberKey = marks.find((m) => m.startsWith('__reactFiber$'))
  if (fiberKey) {
    let fiber = (start as AnyEl)[fiberKey] as Record<string, unknown> | undefined
    for (let hops = 0; fiber && hops < 24; hops++) {
      const type = fiber.type as Record<string, unknown> | undefined
      const name = (type?.displayName ?? type?.name) as string | undefined
      if (name && !name.startsWith('_')) return { framework: 'react', label: name }
      fiber = fiber.return as Record<string, unknown> | undefined
    }
    return { framework: 'react', label: start.tagName.toLowerCase() }
  }
  const vueComp = (start as AnyEl).__vueParentComponent as Record<string, unknown> | undefined
  if (vueComp) {
    const type = vueComp.type as Record<string, unknown> | undefined
    const name = (type?.name ?? type?.__name ?? (type?.__file as string | undefined)?.split(/[/\\.]/).at(-2)) as string | undefined
    return { framework: 'vue', label: name ?? start.tagName.toLowerCase() }
  }
  for (const cls of start.classList) {
    const m = /^svelte-([a-z0-9]+)$/.exec(cls)
    if (m) return { framework: 'svelte', label: `svelte:${m[1]}` }
  }
  if ((start as AnyEl)._$host || marks.some((m) => m.startsWith('_$') || m.startsWith('$signal'))) {
    return { framework: 'solid', label: start.tagName.toLowerCase() }
  }
  return undefined
}

export function cssPath(target: HTMLElement): string {
  const parts: string[] = []
  let node: Element | null = target
  while (node && node.tagName !== 'BODY' && parts.length < 6) {
    let seg = node.tagName.toLowerCase()
    if (node.id) seg += `#${node.id}`
    else {
      const parent: Element | null = node.parentElement
      if (parent) {
        const same = [...parent.children].filter((c) => c.tagName === node!.tagName)
        if (same.length > 1) seg += `:nth-of-type(${same.indexOf(node) + 1})`
      }
    }
    parts.unshift(seg)
    if (node.id) break
    node = node.parentElement
  }
  return parts.join(' > ')
}

export function describe(target: HTMLElement): ElementInfo {
  let up: HTMLElement | null = target
  let found: { framework: string; label: string } | undefined
  while (up && !found) {
    found = componentOf(up)
    up = up.parentElement
  }
  const attrs = [...target.attributes]
    .filter((a) => /^(id|class|data-testid|role|href)$/.test(a.name))
    .map((a) => `${a.name}="${a.value.slice(0, 60)}"`)
    .join(' ')
  return {
    framework: found?.framework ?? globalFramework(),
    componentLabel: found?.label,
    tagName: target.tagName.toLowerCase(),
    cssPath: cssPath(target),
    textPreview: (target.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 140),
    attributes: attrs,
  }
}
