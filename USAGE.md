# USAGE

`wrikka-vite-devtools` = one Vite plugin that mounts the Devframe hub, the add-on frames, and the
comment→agent overlay. This file documents the real public surface, every RPC, and the MCP tools.

## 1. Install

Preview releases come from pkg.pr.new (the package is not on npm):

```bash
bun add -D "wrikka-vite-devtools@https://pkg.pr.new/wrikka/wrikka-vite-devtools@<ref>"
```

In `vite.config.ts` the plugin must be listed **before** framework plugins that transform the
HTML/SSR entry (e.g. `tanstackStart()`, `solid()`), so the hub middleware is installed first.

```ts
import { useWrikkaViteDevtools } from 'wrikka-vite-devtools/vite'

export default defineConfig({
  plugins: [useWrikkaViteDevtools({ auth: false }), solid(), tanstackStart()],
})
```

## 2. Exports

| Specifier | Gives |
|---|---|
| `wrikka-vite-devtools` | `useWrikkaViteDevtools` (+ default), `devframeDefinition`, `createDevframeDefinition`, `defaultSkillRoots`, `getMeta`, `scanDir`, types |
| `wrikka-vite-devtools/vite` | `useWrikkaViteDevtools`, `UseWrikkaViteDevtoolsOptions`, `UseWrikkaViteDevtoolsPluginKey` |
| `wrikka-vite-devtools/devframe` | the built devframe definition (default) + `createDevframeDefinition` |

## 3. `useWrikkaViteDevtools(options)`

| Option | Type | Default | Effect |
|---|---|---|---|
| `base` | `string` | `/__devframes/` | hub mount; each frame lives at `<base><id>/` |
| `plugins` | `UseWrikkaViteDevtoolsPluginKey[] \| 'all'` | all add-ons except `data-inspector`, `code-server`, `unocss` | which frames to mount |
| `mcp` | `boolean \| 'auto'` | `'auto'` | aggregate MCP endpoint at `<base>__mcp` |
| `auth` | `boolean` | hub gate | `false` closes the OTP gate — localhost single-user only |
| `build` | `boolean` | off | bake the static hub into `vite build` output |
| `quiet` | `boolean` | off | silence the Vite DevTools recommendation notice |
| `skillsRoots` | `string[]` | `defaultSkillRoots()` | extra/override directories scanned by `list-skills` |
| `agent.driver` | `'auto' \| 'claude' \| 'codex' \| 'opencode'` | `'auto'` | which CLI drives comment runs and idea generation |
| `agent.autoRun` | `boolean` | `true` | start the agent the moment a `kind: 'comment'` is submitted |
| `overlay` | `boolean` | `true` | `false` drops the page-script (no in-page comment pill); the Comments dock page itself has no dock button — its entry points are the pill's hub link and `<base>wrikka-vite-devtools/` |

`defaultSkillRoots()` scans: `<devin>/skills` (AppData), `~/.claude/skills`, `~/.qoder/skills`,
`./skills`, `./.claude/skills`, `./.devin/skills`. Unknown plugin keys throw at config load.

### UnoCSS in the dock

`unocss` is a **dock-only** key — it mounts no devframe. `@unocss/vite` serves its inspector as a
standalone app at `/__unocss`, and its own devframe registers with Vite's devtools API, not the
Devframe hub, so the hub never sees it. This key frames the already-served inspector instead:

```ts
useWrikkaViteDevtools({ plugins: ['inspect', 'git', 'unocss'] })
```

It requires `unocss` in the Vite config with its inspector enabled (the default;
`inlineConfig.inspector: false` kills `/__unocss` and leaves a dead panel).

## 4. Overlay flow

Two halves: the **pill** in your page and the **Comments** tab in the hub. The pill keeps what needs
the live DOM (node picking, pinned annotations, the composer for the node you just picked); the
inbox, ideas and runner diagnostics live in the hub panel.

### In-page pill

A Solid + UnoCSS pill (`#wrikka-vite-devtools-overlay-host`, shadow DOM, top-layer z-index) anchored
bottom-right — 36 px tall, rounded, it does not cover the page. It carries a status dot
(idle / queued / running), the `element | component | page` mode `<select>`, **Comment**, a **Pins**
toggle, and the hub link with a badge counting `queued + running`. `Esc` closes the composer;
`Ctrl`/`Cmd`+`Enter` submits it. The pill never mounts inside hub or dock documents
(`src/overlay/hub.ts` → `isHubDocument`), so the panel does not get a duplicate of itself.

1. `element` / `component` → capture-phase picker highlights the element under the cursor
   (`Esc` cancels); a click locks it. `component` additionally resolves the nearest framework
   component name. `page` skips the picker and targets the whole document.
2. **Comment** → composer above the pill: body, `comment | idea` kind, *capture page* checkbox
   (PNG via `html-to-image` → `save-capture`), and skill chips from `list-skills` (≤30 shown,
   multi-select). Submit writes the comment; with `autoRun` the agent CLI starts immediately.
3. **Pins** → annotations: every `element`/`component` comment on the current page gets a numbered
   pin anchored to its element (`src/overlay/ui/Pins.tsx` + `anchor.ts`). Pins follow scroll/resize,
   clamp to the viewport, and a click opens a bubble with the body, status pill, `mode @ cssPath`
   and the agent's `resultSummary`. The toggle hides/shows all pins. **Page**-mode comments never
   pin.
4. Pins, the status dot and the badge refresh from the `list-comments` poll every 5 s.
5. **Hub link** (right edge) → the devframe hub at `<hubBase>`, with the current page url appended
   as `?page=`. `src/overlay/hub.ts` derives `<hubBase>` from the module URL the hub served the pill
   from (`…/__page-script/index.mjs` → its parent mount, `…/wrikka-vite-devtools/` stripped),
   falling back to `/__devframes/` — so a hub mounted under a base path still links correctly.
   The glyphs are inline SVG: no Iconify request, works offline.

### Hub Comments panel

The same SPA is the hub **Comments** dock page (`<base>wrikka-vite-devtools/`), a tabbed panel
(`role="tablist"`): **Inbox**, **New comment**, **Ideas**, **Diagnostics**.

1. **Inbox** → list of comments (newest first, polled every 2 s) with status pill, selection, skills,
   capture path and `resultSummary`; **Re-run** calls `run-agent` and streams logs live.
2. **New comment** → the target form (page url, mode, cssPath) then the page-agnostic composer. The
   page field is prefilled from the `?page=` link or, because the hub drops that query before it
   mounts the dock iframe, from the url the pill stashed on this origin (`src/ui/page-stash.ts`).
3. **Ideas** → `generate-ideas` (optional focus text) renders selectable cards (title/detail/impact);
   **Apply** switches to **New comment** prefilled with `Implement: <title> — <detail>`.
4. **Diagnostics** → `runner-info` (active driver + installed CLIs) and frame metadata.

Framework detection (`src/overlay/frameworks.ts`) reads, in order: React `__reactFiber$*` walk,
Vue `__vueParentComponent`, Svelte `svelte-<hash>` class, Solid `_$*`/`$signal*` marks, then global
markers (`__NUXT__`, `__NEXT_DATA__`, `__SVELTEKIT_*`, `__VUE__`, `__REACT_REFRESH__`).

**How the pill gets into the page.** The hub injects `<script type="module" src="<base>embedded.js">`
through Vite's `transformIndexHtml`, which only runs for file-backed `index.html` SPAs. SSR
frameworks that render the document in JS and stream it (TanStack Start / Solid Start, Nuxt,
SvelteKit) never hit that hook, so `wrikka-vite-devtools` also mounts a dev-only middleware
(`src/ssr-inject.ts`) that patches the response stream and inserts the same tag before the first
`</body>`. It holds back 6 bytes so a `</body>` split across chunks is not missed, skips responses
that are not `text/html` or already carry `content-length`, and never double-injects when the hub's
own transform already ran. Disable all of it with `overlay: false`.

## 5. RPC reference

All ids are namespaced `wrikka-vite-devtools` (`scope.rpc.call('list-comments')`, MCP `wrikka-vite-devtools_list-comments`).

| Id | Kind | Args | Returns |
|---|---|---|---|
| `get-meta` | static | — | project/cwd/frames meta |
| `scan-dir` | query | `{ path, glob?, limit? }` | `{ files, truncated }` |
| `list-comments` | query | — | `{ items: Comment[] }` |
| `submit-comment` | action | `{ body, page, kind?, selection, skills?, capturePath? }` | `Comment` |
| `update-comment` | action | `{ id, status?, resultSummary? }` | `{ updated: boolean }` |
| `delete-comment` | action | `{ id }` | `{ deleted: boolean }` |
| `run-agent` | action | `{ commentId }` | `{ started, streamId?, reason? }` |
| `cancel-agent` | action | `{ commentId }` | `{ cancelled: boolean }` |
| `runner-info` | static | — | `{ preference, driver \| null, available[] }` |
| `list-skills` | query | — | `{ skills: {name,description,path,root}[], roots }` |
| `save-capture` | action | `{ dataUrl, page }` | `{ path, bytes }` |
| `list-captures` | query | — | `{ files: {name,path}[] }` (newest 50) |
| `generate-ideas` | action | `{ page, focus? }` | `{ ideas: {title,detail,impact}[], driver \| null, raw? }` |

Streaming channel `agent-logs` (replay window 4 KiB, closed streams kept 5 min):

```ts
for await (const chunk of scope.rpc.streaming.subscribe<string>('agent-logs', streamId)) {
  process.stdout.write(chunk)
}
```

Limits: body ≤8000 chars, ≤20 skills per comment, ideas run ≤5 min, comment run ≤15 min.

## 6. Client usage

```ts
import { connectDevframe } from 'devframe/client'

const scope = (await connectDevframe()).scope('wrikka-vite-devtools')
const { items } = await scope.rpc.call('list-comments')
const comment = await scope.rpc.call('submit-comment', {
  body: 'Move the filter row above the results',
  page: location.pathname,
  kind: 'comment',
  selection: { mode: 'page', framework: 'solid', cssPath: 'html' },
  skills: ['improve-form'],
})
const { streamId } = await scope.rpc.call('run-agent', { commentId: comment.id })
```

Typed ids come from `src/client/typed-rpc.d.ts` (module augmentation of
`DevframeRpcClientFunctions`), so `scope.rpc.call('submit-comment', …)` is checked in the panel SPA.

The shipped panel SPA at `<base>wrikka-vite-devtools/` (built from `src/client/`) is the hub
**Comments** tab: its Inbox tab calls `runner-info`, `list-skills` and `list-comments` (polled every
2 s), the New comment tab offers the target form + composer (kind / mode / cssPath / page /
multi-select skills), Inbox has Re-run per comment and streams `agent-logs` into each card, and
Ideas / Diagnostics cover `generate-ideas` and the runner state. It is styled with UnoCSS
(`presetWind4` + variant-group and directives transformers, no shortcuts). If you rebuild
`src/client/` yourself, keep the three build settings documented in
[`CONTRIBUTING.md`](CONTRIBUTING.md): explicit
`UnoCSS(resolve(import.meta.dirname, 'uno.config.ts'))`, a `content.pipeline.include` that also
matches plain `.ts`, and `base: './'`.

### Driving the agent from the hub panel (opencode pattern)

The Comments tab is the complete agent console — no page overlay needed. Pin the driver once:

```ts
useWrikkaViteDevtools({ agent: { driver: 'opencode' } })
```

1. Open `<base>wrikka-vite-devtools/` — the **Diagnostics** tab comes from `runner-info`; `driver: opencode` confirms the
   pin, `available` lists every installed CLI (`'auto'` would pick the first of claude → codex →
   opencode).
2. Submit with kind `comment` → `autoRun` immediately runs `opencode run` in the project cwd with
   the prompt written to **stdin** — no shell quoting, safe for `.cmd` shims on Windows. The same
   path serves comments created from the overlay or via MCP: one store, one runner.
3. The card streams stdout live; the run ends with `exit 0 ok` and the `SUMMARY:` line the prompt
   demands becomes the comment's `resultSummary` (15-min timeout).
4. **Re-run** on any card calls `run-agent` for that comment and subscribes to a fresh
   `agent-logs` stream (`comment-<id>-<ts>`).
5. Kind `idea` never spawns on submit — `autoRun` only fires for `kind: 'comment'`, so ideas are
   safe for probing.
6. **Cancel** (shown while a card is `running`) calls `cancel-agent`, aborts the child process, and
   marks the comment `failed` with `resultSummary: cancelled by user`. **Dismiss** calls
   `delete-comment` to remove the comment from the store.

## 7. MCP

`POST <base>__mcp` (requires an `Origin` header matching the Vite server). `tools/list` aggregates
every mounted frame: `wrikka-vite-devtools_*` (one per RPC above) plus `devframes_plugin_*` and
`devframes_service_git_*`. Point any MCP client (Devin/Claude/Qoder) at the URL to let it read the
inbox, submit comments, and start runs from outside the browser.

```bash
curl -s -X POST http://localhost:5199/__devframes/__mcp \
  -H 'Content-Type: application/json' -H 'Origin: http://localhost:5199' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | head -c 400
```

Replies are SSE (`event: message` / `data: {jsonrpc}`). `tools/call` takes **positional** args —
one `argN` per declared RPC argument, so a single-object signature becomes `{"arg0": {…}}`:

```bash
curl -s -X POST http://localhost:5199/__devframes/__mcp \
  -H 'Content-Type: application/json' -H 'Origin: http://localhost:5199' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{
        "name":"wrikka-vite-devtools_list-comments","arguments":{"arg0":{}}}}'
```

A flat object instead of `{"arg0": …}` fails with `DF0043 … received an invalid argument at position 0`.

## 8. On-disk state

Under the hub project storage dir (`ctx.host.getStorageDir('project')`):

| Path | Written by |
|---|---|
| `comments.json` | `CommentStore` — every comment/idea + status + `streamId` |
| `captures/<ts>-<page-slug>.png` | `save-capture` |

## 9. Recipes

```ts
// no agent automation, devtools hub only
useWrikkaViteDevtools({ overlay: false, agent: { autoRun: false } })

// pin the driver and add a project skill folder
useWrikkaViteDevtools({ agent: { driver: 'codex' }, skillsRoots: ['./.devin/skills', 'C:/me/devin-skills'] })

// opencode as the only driver, worked entirely from the hub Comments tab (see §6)
useWrikkaViteDevtools({ agent: { driver: 'opencode', autoRun: true }, overlay: false })

// minimal mount — only the comment/agent frame
useWrikkaViteDevtools({ plugins: ['wrikka-vite-devtools'] })
```

## 10. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `no agent CLI found` in a comment | no `claude`/`codex`/`opencode` on PATH — install one or pin `agent.driver` |
| Overlay pill missing but hub opens | `overlay: false`, or the frame is not `dev`-capable in build output |
| Overlay pill missing in an SSR app (TanStack Start / Nuxt / SvelteKit) | the `wrikka-vite-devtools:ssr-inject` middleware is dev-only and injects into streamed HTML only when `Accept` includes `text/html` and no `content-length` is set — a prerendered/cached document won't get the pill; load the page through the dev server |
| Console: `exports no callable "default"` | the page-script module has no callable default — the dock executor calls `mod.default(hubContext)` |
| Looking for Inbox/Ideas on the pill | they were never there: the pill carries the mode picker, Comment, Pins and the **hub link** only; the list, submit form, ideas and runner live in the hub **Comments** tab at `<base>wrikka-vite-devtools/` |
| Hub dock icon blank | `@devframes/hub-ui` resolves the dock `icon` at runtime from `api.iconify.design`; offline/blocked network ⇒ no glyph. The in-page pill is immune (inline SVG); the dock icon is a package-level choice, not something the page script controls |
| Ideas return `raw` only | the CLI answered in prose — `parseIdeas` needs `title — detail` / JSON-ish lines; refine the focus text |
| Picker never highlights | the app stops `mousemove` at capture phase or an element overlays the whole page |
| `DF8004` on `data-inspector` | already handled — the plugin re-keys the id (colons are not hub-mountable) |
| 403 from MCP | missing `Origin` header (Vite origin check) |
