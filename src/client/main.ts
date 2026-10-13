import { connectDevframe } from 'devframe/client'

const metaOut = document.querySelector<HTMLPreElement>('#meta-out')!
const section = document.querySelector<HTMLElement>('#scan')!
const form = document.querySelector<HTMLFormElement>('#scan-form')!
const input = document.querySelector<HTMLInputElement>('#scan-path')!

function render(target: HTMLElement, data: unknown) {
  target.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
}

const demo = (await connectDevframe()).scope('use-devfra')

try {
  render(metaOut, await demo.rpc.call('get-meta'))
} catch (err) {
  render(metaOut, `meta unavailable: ${String(err)}`)
}

async function runScan(path: string) {
  const note = document.createElement('p')
  note.className = 'note'
  const list = document.createElement('ul')
  section.replaceChildren(form, note, list)
  try {
    const result = await demo.rpc.call('scan-dir', { path, limit: 30 })
    note.textContent = `${result.dir} — ${result.entries.length} entries${result.truncated ? ' (truncated)' : ''}`
    for (const entry of result.entries) {
      const li = document.createElement('li')
      li.textContent = `${entry.kind === 'dir' ? '[d]' : '[f]'} ${entry.name}${entry.size != null ? ` (${entry.size} B)` : ''}`
      list.append(li)
    }
  } catch (err) {
    note.textContent = `scan unavailable (static build has no live backend): ${String(err)}`
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault()
  runScan(input.value || '.')
})

runScan('.')
