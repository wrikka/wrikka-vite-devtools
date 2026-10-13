export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, unknown> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = String(value)
    else if (key.startsWith('on') && typeof value === 'function')
      node.addEventListener(key.slice(2), value as EventListener)
    else if (value !== undefined && value !== null && value !== false) node.setAttribute(key, String(value))
  }
  for (const child of children) node.append(typeof child === 'string' ? document.createTextNode(child) : child)
  return node
}

const STYLE = `
:host { all: initial; }
.bar { position: fixed; right: 12px; bottom: 12px; z-index: 2147483000; display: flex; gap: 6px;
  align-items: center; padding: 6px 8px; border-radius: 10px; background: #17181d; color: #e8e9ed;
  font: 12px/1.4 ui-sans-serif, system-ui, sans-serif; box-shadow: 0 4px 18px rgba(0,0,0,.45); }
.bar select, .bar button { font: inherit; color: inherit; background: #26282f; border: 1px solid #3a3d46;
  border-radius: 6px; padding: 3px 8px; cursor: pointer; }
.bar button:hover, .bar select:hover { background: #343741; }
.bar .badge { background: #4c6ef5; border-radius: 999px; padding: 0 6px; font-weight: 600; }
.panel { position: fixed; right: 12px; bottom: 56px; z-index: 2147483001; width: min(420px, calc(100vw - 24px));
  max-height: min(70vh, 640px); overflow: auto; padding: 12px; border-radius: 12px; background: #17181d;
  color: #e8e9ed; font: 12px/1.5 ui-sans-serif, system-ui, sans-serif; box-shadow: 0 8px 30px rgba(0,0,0,.5);
  display: flex; flex-direction: column; gap: 8px; }
.panel textarea { font: inherit; width: 100%; min-height: 84px; resize: vertical; background: #26282f;
  color: inherit; border: 1px solid #3a3d46; border-radius: 8px; padding: 8px; }
.panel input[type=text] { font: inherit; background: #26282f; color: inherit; border: 1px solid #3a3d46;
  border-radius: 8px; padding: 6px 8px; }
.panel .row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.panel h3 { margin: 0; font-size: 13px; }
.hint { color: #9aa0ab; }
.chip { border: 1px solid #3a3d46; background: #26282f; border-radius: 999px; padding: 2px 8px; cursor: pointer; }
.chip.on { background: #4c6ef5; border-color: #4c6ef5; color: #fff; }
.primary { background: #4c6ef5 !important; border-color: #4c6ef5 !important; color: #fff; font-weight: 600; }
.comment { border: 1px solid #3a3d46; border-radius: 8px; padding: 8px; display: flex; flex-direction: column; gap: 4px; }
.status { font-weight: 700; font-size: 10px; text-transform: uppercase; border-radius: 4px; padding: 1px 5px; width: fit-content; }
.status.queued { background: #5c5f2e; } .status.running { background: #2f5aa8; }
.status.done { background: #2e6b45; } .status.failed { background: #7c2d3a; }
.logs { background: #0f1013; border-radius: 8px; padding: 8px; max-height: 200px; overflow: auto;
  font: 11px/1.4 ui-monospace, monospace; white-space: pre-wrap; }
.cards { display: grid; gap: 8px; }
.card { border: 1px solid #3a3d46; border-radius: 10px; padding: 10px; display: flex; flex-direction: column; gap: 6px; }
.impact { width: fit-content; font-weight: 700; font-size: 10px; border-radius: 4px; padding: 1px 6px; }
.impact.High { background: #7c2d3a; } .impact.Medium { background: #7a5b1e; } .impact.Low { background: #2e6b45; }
.pick { position: fixed; z-index: 2147483002; pointer-events: none; border: 2px solid #4c6ef5;
  background: rgba(76,110,245,.12); border-radius: 3px; }
.pick-tip { position: fixed; z-index: 2147483003; pointer-events: none; background: #17181d; color: #e8e9ed;
  font: 11px ui-monospace, monospace; border-radius: 6px; padding: 2px 8px; box-shadow: 0 2px 10px rgba(0,0,0,.4); }
`

/** One host element per overlay UI, styles isolated in a shadow root. */
export function mount(id: string): ShadowRoot {
  const existing = document.getElementById(id)
  if (existing?.shadowRoot) return existing.shadowRoot
  const host = el('div', { id })
  const root = host.attachShadow({ mode: 'open' })
  root.append(el('style', {}, [STYLE]))
  document.body.append(host)
  return root
}

export function unmount(id: string): void {
  document.getElementById(id)?.remove()
}

export interface PanelHandle {
  body: HTMLElement
  remove(): void
}

export function panel(root: ShadowRoot, title: string): PanelHandle {
  const close = el('button', { onclick: () => node.remove() }, ['✕'])
  const head = el('div', { class: 'row' }, [el('h3', {}, [title]), close])
  const body = el('div', { class: 'row' })
  const node = el('div', { class: 'panel', role: 'dialog', 'aria-label': title }, [head, body])
  root.append(node)
  return { body, remove: () => node.remove() }
}

export { STYLE as overlayCss }
