import { For, Show, createSignal } from 'solid-js'
import type { RouteRow } from '../rpc/routes'
import type { SeoRow } from '../rpc/seo'
import type { PanelApi } from '../ui/api'
import { btn, card, chip, hint, link, row, statusPill } from '../ui/bits'
import SendToAgent from '../ui/SendToAgent'

export interface RouteDetailProps {
  api: PanelApi
  root(): string
  route: RouteRow
  seo?: SeoRow
}

function flags(r: RouteRow): string[] {
  return [
    r.hasLoader ? 'loader' : undefined,
    r.hasHead ? 'head' : undefined,
    r.ssrOff ? 'ssr off' : undefined,
    r.params.length > 0 ? `params: ${r.params.join(', ')}` : undefined,
    r.title ? `title: ${r.title}` : undefined,
  ].filter(Boolean) as string[]
}

/** What one route declares in source and what the dev server actually served for it. */
export default function RouteDetail(p: RouteDetailProps) {
  const [open, setOpen] = createSignal(false)
  const seo = () => p.seo

  return (
    <div class={`${card} bg-control/40`}>
      <div class="flex flex-col gap-1">
        <div class={row}>
          <span class={hint}>source</span>
          <a class={`${link} text-[11px]`} href={`vscode://file/${p.root()}/${p.route.file}`}>
            {p.route.file}
          </a>
        </div>
        <Show when={flags(p.route).length > 0}>
          <div class={row}>
            <For each={flags(p.route)}>{(f) => <span class={chip}>{f}</span>}</For>
          </div>
        </Show>
        <Show when={p.route.description}>
          <p class={hint}>declared description: {p.route.description}</p>
        </Show>
      </div>

      <Show
        when={seo()}
        fallback={<p class={hint}>Not audited yet — press “Audit served HTML” above (needs the dev server on this origin).</p>}
      >
        {(s) => (
          <div class="flex flex-col gap-1 border-t border-solid border-line pt-1.5">
            <div class={row}>
              <span
                class={statusPill(
                  s().issues.some((i) => i.level === 'bad') ? 'failed' : s().issues.length ? 'queued' : 'done',
                )}
              >
                {s().status === -1 ? 'timeout' : s().status}
              </span>
              <span class={hint}>
                {s().ms} ms · {(s().bytes / 1024).toFixed(1)} kB · h1 ×{s().h1} · lang “{s().lang ?? '—'}”
              </span>
              <a class={`${link} ml-auto text-[11px]`} href={s().url} target="_blank" rel="noreferrer">
                open
              </a>
            </div>
            <p class="break-all font-mono text-[11px] text-ink">title: {s().title ?? '(none)'}</p>
            <p class={hint}>description: {s().description?.slice(0, 160) ?? '(none)'}</p>
            <Show when={Object.keys(s().og).length > 0 || Object.keys(s().twitter).length > 0}>
              <div class={row}>
                <For each={Object.entries({ ...s().og, ...s().twitter })}>{([k, v]) => (
                  <span class={`${chip} max-w-full truncate`} title={`${k}: ${v}`}>{k}</span>
                )}</For>
              </div>
            </Show>
            <Show when={s().canonical}>
              <p class={`${hint} break-all`}>canonical: {s().canonical}</p>
            </Show>
            <button class={`${btn} w-fit`} onClick={() => setOpen(!open())}>
              {open() ? 'hide issues' : `${s().issues.length} issue(s)`}
            </button>
            <Show when={open()}>
              <div class="flex flex-col gap-0.5">
                <For each={s().issues}>{(i) => (
                  <span class={`${hint} ${i.level === 'bad' ? 'text-bad-ink' : 'text-warn-ink'}`}>
                    {i.level === 'bad' ? '✗' : '!'} {i.what}
                  </span>
                )}</For>
              </div>
            </Show>
          </div>
        )}
      </Show>

      <SendToAgent
        api={p.api}
        page={p.route.path}
        selection={{ mode: 'page', cssPath: p.route.file }}
        placeholder={`e.g. add an og:image to ${p.route.path}`}
      />
    </div>
  )
}
