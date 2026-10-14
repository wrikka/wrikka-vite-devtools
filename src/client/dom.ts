export interface ClientApi {
  call(id: string, args?: unknown): Promise<any>
  subscribe(channel: string, id: string): AsyncIterable<string>
}

const FIELD = 'rounded border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700'

export function select(marker: string, values: string[]): HTMLSelectElement {
  const s = document.createElement('select')
  s.className = FIELD
  for (const v of values) s.add(option(v, v))
  s.setAttribute('data-select', marker)
  return s
}

export function option(value: string, text: string): HTMLOptionElement {
  const o = document.createElement('option')
  o.value = value
  o.textContent = text
  return o
}

export function label(text: string): HTMLElement {
  const l = document.createElement('p')
  l.className = 'text-xs text-neutral-500'
  l.textContent = text
  return l
}

export function row(nodes: Node[]): HTMLElement {
  const d = document.createElement('div')
  d.className = 'flex flex-wrap items-center gap-2'
  d.append(...nodes)
  return d
}

export function paragraph(text: string): HTMLElement {
  const p = document.createElement('p')
  p.className = 'text-sm'
  p.textContent = text
  return p
}

export function hint(text: string): HTMLElement {
  const p = document.createElement('p')
  p.className = 'text-xs text-neutral-500'
  p.textContent = text
  return p
}
