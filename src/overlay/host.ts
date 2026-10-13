import { overlayCss } from './css'

const HOST_ID = 'devfra-overlay-host'

/** One shadow host per page; the inlined stylesheet lives inside the root. */
export function mountShadowHost(): ShadowRoot {
  const existing = document.getElementById(HOST_ID)
  if (existing?.shadowRoot) return existing.shadowRoot
  const host = document.createElement('div')
  host.id = HOST_ID
  const root = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = overlayCss
  root.append(style)
  document.body.append(host)
  return root
}
