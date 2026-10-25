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
| `base` | `string` | `/__devtools/` | hub mount; each frame lives at `<base><id>/` |
| `plugins` | `UseWrikkaViteDevtoolsPluginKey[] \| 'all'` | every default add-on and panel dock; `data-inspector`, `code-server`, `unocss` are opt-in | which frames and docks to mount |
| `mcp` | `boolean \| 'auto'` | `'auto'` | aggregate MCP endpoint at `<base>__mcp` |
| `auth` | `boolean` | hub gate | `false` closes the OTP gate — localhost single-user only |
| `build` | `boolean` | off | bake the static hub into `vite build` output |
| `quiet` | `boolean` | off | silence the Vite DevTools recommendation notice |
| `role` | `'operator' \| 'viewer'` | `WRIKKA_DEVTOOLS_ROLE`, then `operator` | `viewer` keeps every scanner but refuses mutations |
| `skillsRoots` | `string[]` | `defaultSkillRoots()` | extra/override directories scanned by `list-skills` |
| `agent.driver` | `'auto' \| 'claude' \| 'codex' \| 'opencode'` | `'auto'` | which CLI drives comment runs and idea generation |
| `agent.autoRun` | `boolean` | `true` | start the agent the moment a `kind: 'comment'` is submitted |
| `overlay` | `boolean` | `true` | `false` drops the in-page icon; the hub Comments dock and every panel stay reachable |
| `dock` | `{ mode?: 'float' \| 'edge'; position?: 'left' \| 'right' \| 'top' \| 'bottom' }` | `{ mode: 'edge', position: 'left' }` | where the dock opens on a first visit; the visitor's own placement wins from then on |

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

### Solid in the dock

`solid` is also a **dock-only** key. It frames this package's own client at `#/solid`, in the
`framework` category, and reads the live Solid owner tree — components, computations, effects, their
sources, and unowned top-level signals.

The panel reads `globalThis.SolidDevtools$$`, so the host app must attach the debugger itself:

```sh
bun add -d @solid-devtools/debugger
```

```ts
// app entry, before render(...)
import '@solid-devtools/debugger/setup'
```

Without it the panel stays in "not attached" mode and shows those steps. It only works in a
development build, because production strips Solid's DEV hooks. Pass a list without `solid` to drop
the dock.

### Panels in the dock

Eighteen keys frame this package's own client at `#/<key>` — Home, Components, Routes & SEO and the
fourteen audit panels below (Solid and UnoCSS have their own sections). Each is a route of one SPA,
so the hash equals the dock id and `<base>wrikka-vite-devtools/#/<key>` is a direct, shareable link.
Home is registered first, so the dock rail lands on it.

| Key | Panel | Source of truth |
|---|---|---|
| `home` | Home | onboarding, live counts, install/config tabs |
| `components` | Components | component grid with refs, exports and a LOC budget |
| `routes` | Routes & SEO | route table plus an audit of the served HTML |
| `theme` | Theme & Tokens | `theme.ts` palette vs utilities used in source |
| `network` | Network | overlay-captured fetch/XHR, replayable |
| `runs` | Runs & Queue | agent runs, durations, cancel, streamed logs |
| `mcp-playground` | MCP Playground | the hub's own MCP tools and their schemas |
| `performance` | Performance | web vitals and slow resources from the overlay |
| `console` | Console & Logs | page console merged with agent output |
| `bundle` | Bundle | Vite module graph, largest client modules |
| `env` | Env & Config | `import.meta.env` references vs `.env`, redacted |
| `visual-diff` | Visual Diff | saved captures compared against the live page |
| `tests` | Tests | the spec matching a source file and its result |
| `state` | State Snapshots | route, DOM and storage samples over time |
| `imports` | Import Graph | importers and unused exports per file |
| `i18n` | i18n | missing keys, hardcoded copy, locale coverage |
| `security` | Security Headers | CSP, HSTS and COOP on served HTML |

The runtime panels (`network`, `console`, `performance`, `state`) read the overlay's ring buffers, so
the overlay must be on (`overlay: true`, the default) for them to fill. The source and build panels
read the project through the Vite dev server.

## 4. Overlay flow

Two halves: the **comment icon** in your page and the **Comments** tab in the hub. The icon keeps what
needs the live page (the inline composer and the pinned annotations already stored); the inbox, ideas
and runner diagnostics live in the hub panel.

### In-page comment icon

One round icon (`#wrikka-vite-devtools-overlay-host`, shadow DOM, top-layer z-index) anchored
bottom-left at `left-14`, so it clears the hub's 40 px dock rail — it carries a status dot
(idle / queued / running) and a badge counting `queued + running`. Clicking toggles the inline composer; `Esc` closes it and `Ctrl`/`Cmd`+`Enter` submits.
The icon never mounts inside hub or dock documents (`src/overlay/hub.ts` → `isHubDocument`), so the
panel does not get a duplicate of itself.

1. **Inline composer** → body, `comment | idea` kind, *capture page* checkbox (PNG via
   `html-to-image` → `save-capture`), a **Pins** toggle, and the hub link. Suggestions under the
   input insert the current route or a quick-start prompt with one click.
2. **`@` routes** → typing `@` filters the app's routes (`list-routes`, plus same-origin `<a href>`
   paths as a fallback and the current route). ↑/↓ + Enter/Tab or a click inserts `@/path ` and the
   first mention becomes the comment's target (`selection.cssPath`). There is **no element/component
   inspector** — every new comment targets the page and the mentioned route (`mode: 'page'`).
3. **Pins** → annotations for comments that still carry an element `cssPath` (for example created by
   an agent through MCP): each gets a numbered pin anchored to its element
   (`src/overlay/ui/Pins.tsx` + `anchor.ts`). Pins follow scroll/resize, clamp to the viewport, and a
   click opens a bubble with the body, status pill, `mode @ cssPath` and the agent's
   `resultSummary`. The toggle hides/shows all pins.
4. Status dot and badge refresh from the `list-comments` poll every 5 s; a viewer-role session
   disables the composer and shows a read-only notice.
5. **Hub link** → the devframe hub at `<hubBase>`, with the current page url appended as `?page=`.
   `src/overlay/hub.ts` derives `<hubBase>` from the module URL the hub served the icon from
   (`…/__page-script/index.mjs` → its parent mount, `…/wrikka-vite-devtools/` stripped), falling
   back to `/__devtools/` — so a hub mounted under a base path still links correctly.
   The glyphs are inline SVG: no Iconify request, works offline.

### Hub Comments panel

The same SPA is the hub **Comments** dock page (`<base>wrikka-vite-devtools/`), a tabbed panel
(`role="tablist"`): **Inbox**, **New comment**, **Ideas**, **Diagnostics**.

1. **Inbox** → list of comments (newest first, polled every 2 s) with status pill, selection, skills,
   capture path and `resultSummary`; the tab label shows `Inbox (n)` for the comments still open (any
   status but `done`); filter chips narrow by status, a `Filter by page` select appears once comments
   cover more than one page, a `visible/total` counter tracks the result, and a **cards / list**
   toggle switches between full cards and dense scan rows. Each card links its target page
   (`target="_blank"`) when the page is an `http(s)` url — anything else stays plain text.
   **Re-run** calls `run-agent` and streams logs live; a viewer-role session disables the actions
   with a banner and a toast.
2. **New comment** → the target form (page url, mode, cssPath) then the page-agnostic composer. The
   page field is prefilled from the `?page=` link or, because the hub drops that query before it
   mounts the dock iframe, from the url the pill stashed on this origin (`src/ui/page-stash.ts`).
   The body and the chosen skills autosave per page (debounced 300 ms) to
   `wrikka-vite-devtools:draft:<page>` (`src/ui/draft-stash.ts`), so a tab switch that remounts the
   iframe doesn't lose an unwritten comment; a successful submit clears it.
3. **Ideas** → `generate-ideas` (optional focus text) renders selectable cards (title/detail/impact);
   **Apply** switches to **New comment** prefilled with `Implement: <title> — <detail>`.
4. **Diagnostics** → `runner-info` (active driver + installed CLIs) and frame metadata.

Framework detection (`src/overlay/frameworks.ts`) labels the page for diagnostics: Solid
(`_$HY`, `_$DX_DELEGATE`, `_$host`/`$signal*` marks), React (`__reactFiber$*`, `__NEXT_DATA__`), Vue
(`__vueParentComponent`, `__VUE__`), Svelte (`svelte-<hash>`, `__SVELTEKIT_*`), Nuxt (`__NUXT__`).

**How the icon gets into the page.** The hub injects `<script type="module" src="<base>embedded.js">`
through Vite's `transformIndexHtml`, which only runs for file-backed `index.html` SPAs. SSR
frameworks that render the document in JS and stream it (TanStack Start / Solid Start, Nuxt,
SvelteKit) never hit that hook, so `wrikka-vite-devtools` also mounts a dev-only middleware
(`src/ssr-inject.ts`, stream patch in `src/html-stream.ts`) that inserts the same tag before the
first `</body>`. It holds back 6 bytes so a `</body>` split across chunks is not missed, skips responses
that are not `text/html` or already carry `content-length`, and never double-injects when the hub's
own transform already ran. Disable all of it with `overlay: false`.

## 5. RPC reference

All ids are namespaced `wrikka-vite-devtools` (`scope.rpc.call('list-comments')`, MCP `wrikka-vite-devtools_list-comments`).

| Id | Kind | Args | Returns |
|---|---|---|---|
| `get-meta` | static | — | project/cwd/frames meta + session `role` and `capabilities` |
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
| `list-components` | query | `{ dir? }` | `{ root, components[], truncated }` |
| `list-routes` | query | `{ dir? }` | `{ routes[], detected: 'tanstack-router' \| 'file-based' \| 'none', root }` |
| `search-source` | query | `{ query, scope?: 'local' \| 'components' \| 'routes', limit? }` | `{ query, scope, matches[], truncated }` |
| `audit-theme` | query | `{ dir? }` | `{ root, hasTheme, tokens[], utilities[], violations[], scanned, truncated }` |
| `audit-env` | query | `{ dir? }` | `{ root, scanned, envFiles[], refs[] }` |
| `audit-bundle` | query | — | `{ available, reason?, modules, total, localBytes, depBytes, top[], cycles[] }` |
| `audit-imports` | query | `{ dir? }` | `{ root, scanned, edges, files[], unused[], truncated }` |
| `audit-i18n` | query | `{ dir? }` | `{ root, detected, used[], locales[] }` |
| `audit-seo` | query | `{ origin, paths[] }` | `{ rows[], origin }` |
| `audit-headers` | query | `{ url? }` | `{ ok, url, status, durationMs, score, checks[], error? }` |
| `list-tests` | query | `{ dir? }` | `{ root, tests[], untested[], runner }` |
| `run-test` | action | `{ file }` | `{ file, runner, ok, code, durationMs, output }` |
| `list-mcp-tools` | query | — | `{ ok, endpoint, tools[], error? }` |
| `call-mcp-tool` | action | `{ name, args }` | `{ ok, isError, durationMs, result, error? }` |
| `read-capture` | query | `{ name }` | `{ name, dataUrl, bytes }` |
| `push-runtime-event` | action | `{ events: {kind,at?,data}[] }` | `{ accepted, dropped }` |
| `get-runtime` | query | `{ kind?, since?, limit? }` | `{ kinds: {total,kept,dropped}, events[] }` |
| `clear-runtime` | action | `{ kind? }` | `{ cleared }` |
| `replay-request` | action | `{ url, method?, headers?, body? }` | `{ ok, status, durationMs, headers[], body, truncated, error? }` |

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
curl -s -X POST http://localhost:5199/__devtools/__mcp \
  -H 'Content-Type: application/json' -H 'Origin: http://localhost:5199' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | head -c 400
```

Replies are SSE (`event: message` / `data: {jsonrpc}`). `tools/call` takes **positional** args —
one `argN` per declared RPC argument, so a single-object signature becomes `{"arg0": {…}}`:

```bash
curl -s -X POST http://localhost:5199/__devtools/__mcp \
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

// read-only session for a shared or preview machine
useWrikkaViteDevtools({ role: 'viewer' })
```

## 10. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `no agent CLI found` in a comment | no `claude`/`codex`/`opencode` on PATH — install one or pin `agent.driver` |
| Overlay icon missing but hub opens | `overlay: false`, or the frame is not `dev`-capable in build output |
| Overlay icon missing in an SSR app (TanStack Start / Nuxt / SvelteKit) | the `wrikka-vite-devtools:ssr-inject` middleware is dev-only and injects into streamed HTML only when `Accept` includes `text/html` and no `content-length` is set — a prerendered/cached document won't get the icon; load the page through the dev server |
| Console: `exports no callable "default"` | the page-script module has no callable default — the dock executor calls `mod.default(hubContext)` |
| Looking for Inbox/Ideas on the icon | they were never there: the icon opens the inline composer (body, kind, capture, Pins, hub link) only; the list, submit form, ideas and runner live in the hub **Comments** tab at `<base>wrikka-vite-devtools/` |
| Hub dock icon blank | `@devframes/hub-ui` resolves the dock `icon` at runtime from `api.iconify.design`; offline/blocked network ⇒ no glyph. The in-page icon is immune (inline SVG); the dock icon is a package-level choice, not something the page script controls |
| Ideas return `raw` only | the CLI answered in prose — `parseIdeas` needs `title — detail` / JSON-ish lines; refine the focus text |
| Mutations fail with `read-only session (viewer role)` | the session is a `viewer` — restart with `role: 'operator'` or unset `WRIKKA_DEVTOOLS_ROLE` |
| `@` list is empty | the route scanner found no page files and the document has no same-origin `<a href>` — type the route and submit anyway |
| `DF8004` on `data-inspector` | already handled — the plugin re-keys the id (colons are not hub-mountable) |
| 403 from MCP | missing `Origin` header (Vite origin check) |
