const GLOBAL_MARKERS: [string, RegExp][] = [
  ['nuxt', /__NUXT__/],
  ['next', /__NEXT_DATA__/],
  ['svelte', /__SVELTEKIT(?:_DEV|_EVENTS|_APP)__/],
  ['vue', /__VUE__/],
  ['react', /__REACT(?:_REFRESH__?|HOT)_/],
]

/** The framework owning the page, from the globals each runtime installs. */
export function globalFramework(): string {
  const w = globalThis as Record<string, unknown>
  if (w.__NUXT__) return 'nuxt'
  if (w.__NEXT_DATA__) return 'react'
  if (w.$app || w.__SVELTEKIT_DEV__) return 'svelte'
  // Solid hydration/delegation marks — checked before the generic loop because
  // devtools shims set window.__VUE__ = true in non-Vue apps
  if (w._$HY || '_$DX_DELEGATE' in document) return 'solid'
  for (const [name, re] of GLOBAL_MARKERS) if (Object.keys(w).some((k) => re.test(k))) return name
  return 'unknown'
}
