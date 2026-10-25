> ![Status](https://img.shields.io/badge/status-in_development-red)

# wrikka-vite-devtools

[Devframe](https://devfra.me) devtools hub with all add-ons plus an in-page comment→agent workflow
as a **single Vite plugin** — add `useWrikkaViteDevtools()` to `vite.config.ts` and get the hub at
`/__devtools/`, the **Comments** hub tab, and an aggregate MCP endpoint for agents.

![vite](https://img.shields.io/badge/built%20with-vite-646cff) ![devframe](https://img.shields.io/badge/devframe-1.2.x-7b1fa2) ![agents](https://img.shields.io/badge/agent%20CLI-claude%20%7C%20codex%20%7C%20opencode-0097a7)

```text
+----------------------------------------------------------+
| wrikka-vite-devtools: comment -> agent                   |
|                                                          |
| 1. COMMENT  icon -> inline composer, @route target       |
| 2. SUBMIT   submit-comment -> CommentStore (queued)      |
| 3. RUN      auto-run spawns claude / codex / opencode    |
| 4. WATCH    agent-logs stream into the dock card         |
| 5. RESULT   exit 0 + SUMMARY -> done | failed            |
|                                                          |
| same store and runners reachable from POST __mcp         |
+----------------------------------------------------------+
```

## Get Started

1. Install — previews ship from pkg.pr.new (the package is not on npm):

   ```bash
   bun add -D "wrikka-vite-devtools@https://pkg.pr.new/wrikka/wrikka-vite-devtools@<ref>"
   ```

2. Add the plugin — it must come **before** framework plugins that transform the HTML/SSR entry
   (`tanstackStart()`, `solid()`, …):

   ```ts
   // vite.config.ts
   import { useWrikkaViteDevtools } from 'wrikka-vite-devtools/vite'

   export default defineConfig({
     plugins: [useWrikkaViteDevtools({ auth: false }), solid(), tanstackStart()],
   })
   ```

3. Start your dev server and open the hub:

   ```bash
   bun run dev
   # hub:        http://localhost:<port>/__devtools/
   # frame:      http://localhost:<port>/__devtools/wrikka-vite-devtools/
   # MCP:        POST http://localhost:<port>/__devtools/__mcp
   ```

4. Pin an agent driver (optional) — `'auto'` picks the first installed of claude → codex → opencode:

   ```ts
   useWrikkaViteDevtools({ agent: { driver: 'opencode', autoRun: true } })
   ```

5. Comment and watch — click the comment icon in the page, type `@` to target a route, write the
   request and submit. The agent starts immediately and its log streams into the hub **Comments** tab.

## Features

| Icon | Feature | Description | Benefit | Usage |
|:---:|---|---|---|---|
| ![c](https://api.iconify.design/mdi/comment-edit-outline.svg?color=%231976d2&width=16) | Inline comment composer | One bottom-left icon opens a composer: type `@` to filter routes, pick one with ↑/↓ + Enter or a click, and chips insert the current route or a quick-start prompt. Injected through `transformIndexHtml` or the streamed-SSR middleware, so TanStack Start / Nuxt / SvelteKit pages get it too | comment on the page you are looking at, with no inspector step | click the page icon |
| ![n](https://api.iconify.design/mdi/map-marker-radius-outline.svg?color=%233949ab&width=16) | Pinned annotations | Numbered pins anchor comments that carry an element `cssPath` to their element, with a status / result bubble; **Pins** toggles them | see every open comment in its real page context | **Pins** in the composer |
| ![r](https://api.iconify.design/mdi/robot.svg?color=%237b1fa2&width=16) | Agent auto-run | A submitted comment spawns claude / codex / opencode with the prompt on stdin; stdout streams back on `agent-logs` and the exit summary lands on the comment | idea → edited code without leaving the browser | `agent: { autoRun: true }` |
| ![i](https://api.iconify.design/mdi/inbox-arrow-down.svg?color=%2300796b&width=16) | Comments workspace | Hub tab with Inbox (status chips, page filter, cards ↔ list), Re-run and live logs, a composer with skills + page capture, Ideas and Diagnostics — with operator / viewer gating | drive and audit the whole agent queue from one place | open `<base>wrikka-vite-devtools/` |
| ![h](https://api.iconify.design/mdi/view-dashboard-outline.svg?color=%23607d8b&width=16) | Hub, Home and 19 panels | Home opens the dock rail with onboarding, live stats and install/config tabs (terminal, Vite, MCP client, panel URLs); Components, Routes & SEO, Solid and 14 audit panels share one client build | one plugin wires the whole devtool chain | `plugins: 'all'` |
| ![m](https://api.iconify.design/mdi/hexagon-multiple.svg?color=%23d32f2f&width=16) | Aggregated MCP | Every mounted frame's tools at `POST <base>__mcp`, grouped by app in the MCP Playground with per-tool arg counts and copyable client config | let any agent client read the inbox and call the same tools | `mcp: 'auto'` |

## Dock panels

Home is registered first, so the hub rail lands on it. Every other panel is a route of the same
client SPA, framed at `<base>wrikka-vite-devtools/#/<id>` — the hash equals the dock id, so a panel
is linkable without a second build; Comments is the frame root and carries no hash.

| # | Panel | Route | Reads |
|:--:|---|---|---|
| 1 | Home | `#/home` | onboarding, live counts, install/config tabs (terminal, Vite, MCP, links), every panel |
| 2 | Comments | frame root | inbox, composer, ideas, diagnostics, agent logs |
| 3 | Components | `#/components` | component grid with refs, exports and a LOC budget |
| 4 | Routes & SEO | `#/routes` | route table plus an audit of the HTML the dev server serves |
| 5 | Solid | `#/solid` | live owner tree, signals per owner, unowned signals |
| 6 | Theme & Tokens | `#/theme` | theme palette vs the utilities actually used in source |
| 7 | Network | `#/network` | fetch/XHR captured by the overlay, with replay |
| 8 | Runs & Queue | `#/runs` | every agent run: status, duration, cancel, logs |
| 9 | MCP Playground | `#/mcp-playground` | aggregated hub tools grouped by app, callable in place |
| 10 | Performance | `#/performance` | web vitals plus slow resources from the overlay |
| 11 | Console & Logs | `#/console` | page console merged with live agent output |
| 12 | Bundle | `#/bundle` | the largest client modules from the Vite module graph |
| 13 | Env & Config | `#/env` | `import.meta.env` references vs `.env` files, values redacted |
| 14 | Visual Diff | `#/visual-diff` | saved captures compared against the live page |
| 15 | Tests | `#/tests` | the spec matching a source file, and its run result |
| 16 | State Snapshots | `#/state` | signals, route and storage samples over time |
| 17 | Import Graph | `#/imports` | importers and unused exports per file |
| 18 | i18n | `#/i18n` | missing keys, hardcoded copy, per-locale coverage |
| 19 | Security Headers | `#/security` | CSP, HSTS and COOP on the HTML the dev server serves |

## Usage

### Usage via Vite plugin

```ts
useWrikkaViteDevtools({
  base: '/__devtools/',        // hub mount; each frame lives at <base><id>/
  plugins: 'all',               // or a list of plugin keys
  mcp: 'auto',                  // aggregate MCP endpoint at <base>__mcp
  auth: false,                  // close the OTP gate (localhost single-user)
  agent: { driver: 'auto', autoRun: true },
  skillsRoots: ['./.devin/skills'],
  overlay: true,
  dock: { mode: 'edge', position: 'left' },
})
```

| api | description | options | default |
|---|---|---|---|
| `base` | hub mount path | any `/.../` path | `/__devtools/` |
| `plugins` | which add-on frames to mount | keys \| `'all'` | all except `data-inspector`, `code-server`, `unocss` |
| `mcp` | aggregate MCP endpoint | `boolean \| 'auto'` | `'auto'` |
| `auth` | hub OTP gate | `boolean` | hub gate on |
| `build` | bake the static hub into `vite build` output | `boolean` | off |
| `quiet` | silence the Vite DevTools recommendation notice | `boolean` | off |
| `agent.driver` | which CLI runs comments/ideas | `'auto' \| 'claude' \| 'codex' \| 'opencode'` | `'auto'` |
| `agent.autoRun` | start agent on `kind: 'comment'` submit | `boolean` | `true` |
| `overlay` | inject the in-page comment icon + inline composer | `boolean` | `true` |
| `role` | session capabilities; `viewer` is read-only | `'operator' \| 'viewer'` (or `WRIKKA_DEVTOOLS_ROLE`) | `'operator'` |
| `dock` | where the dock opens on a first visit | `{ mode?: 'float' \| 'edge'; position?: 'left' \| 'right' \| 'top' \| 'bottom' }` | `{ mode: 'edge', position: 'left' }` |
| `skillsRoots` | directories scanned by `list-skills` | `string[]` | `defaultSkillRoots()` |

### Usage via the hub Comments tab (agent workflow)

<details>
<summary>Open <code>/__devtools/wrikka-vite-devtools/</code> and run the full comment → agent loop in the browser</summary>

The shipped panel SPA (UnoCSS `presetWind4`, no shortcuts) is a complete comments client with four
tabs: **Inbox** (labelled `Inbox (n)` with the open count; comment list polled every 2 s, status chips
plus a page filter, a `visible/total` counter, and a **cards / list** layout toggle — list rows are the
dense scan view; each card links its target page, Run/Re-run per comment, live `agent-logs` stream),
**New comment** (target form — page / mode / cssPath — plus the submit composer; the page field is
prefilled from the pill link or the page the pill last stashed on this origin, and an unwritten body
autosaves per page so a tab switch can't lose it), **Ideas**, and
**Diagnostics** (`runner-info`: active driver + every installed CLI). Comments created from the pill,
the panel form, or MCP all share one store. The panel is the hub **Comments** dock tab. Every panel
shares a slim shell (Home breadcrumb, category, `operator` / `viewer` role badge, hub link) and
action feedback through toasts.

The page overlay is a single bottom-left comment icon, offset clear of the hub's 40 px dock rail.
Clicking it opens an inline composer: type `@` to filter the app's routes, pick one with ↑/↓ +
Enter (or click), and the mention is stored as the comment's target. Suggestion chips under the
input insert the current route or a quick-start prompt; the composer also carries the Pins toggle
and the hub link. There is no element inspector — comments target the page and the mentioned route.

```text
+----------------------------------------------------------------+
|  /__devtools/wrikka-vite-devtools/                            |
|  [ Inbox ] [ New comment ] [ Ideas ] [ Diagnostics ]           |
|  +------------------------------------------------------------+|
|  | Comments (poll every 2 s)                                  ||
|  | [queued]  Move filters up                                  ||
|  | [running] Add empty state    > live agent-logs stream      ||
|  | [done]    Fix header   [Re-run]                           ||
|  +------------------------------------------------------------+|
+----------------------------------------------------------------+
```

The agent pattern — drive every run with **opencode** (or any installed CLI) through the panel:

```ts
// vite.config.ts — pin the driver used by auto-run, Re-run and generate-ideas
useWrikkaViteDevtools({ agent: { driver: 'opencode' } })
```

1. The **Diagnostics** tab comes from `runner-info` — `driver: opencode` confirms the pin;
   `available` lists every installed CLI.
2. Submit a comment with kind `comment` → `autoRun` starts `opencode run` in the project cwd with
   the prompt written to **stdin** (no shell quoting, safe for `.cmd` shims on Windows).
3. Watch the card stream stdout live; the run ends with `exit 0 ok` and the captured
   `SUMMARY:` line lands in `resultSummary`.
4. Missed the start? Press **Re-run** — it calls `run-agent` for that comment and re-subscribes
   to a fresh `agent-logs` stream.
5. Use kind `idea` while probing — `autoRun` only fires on `kind: 'comment'`, so ideas are stored
   without spawning a CLI.

| driver | command | notes |
|---|---|---|
| `claude` | `claude -p --output-format json` | JSON `result` field extracted as the summary |
| `codex` | `codex exec --skip-git-repo-check` | prompt on stdin |
| `opencode` | `opencode run` | prompt on stdin; pin via `agent.driver` |

</details>

### Usage via the devframe client API

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
for await (const chunk of scope.rpc.streaming.subscribe<string>('agent-logs', streamId!)) {
  process.stdout.write(chunk)
}
```

| api | description | options | default |
|---|---|---|---|
| `get-meta` | project/cwd/frames meta plus the session `role` and `capabilities` | — | — |
| `list-comments` / `submit-comment` / `update-comment` / `delete-comment` | comment store RPCs | see [`USAGE.md`](USAGE.md) §5 | — |
| `run-agent` / `cancel-agent` / `runner-info` | start/cancel a run / inspect drivers | `{ commentId }` / `{ commentId }` / — | — |
| `list-skills` | skills from all configured roots | — | — |
| `save-capture` / `list-captures` / `read-capture` | PNG snapshot storage | `{ dataUrl, page }` / — / `{ name }` | — |
| `generate-ideas` | agent-proposed idea cards | `{ page, focus? }` | — |
| `list-routes` / `list-components` / `search-source` | scanners behind the dock panels | `{ dir? }` / `{ dir? }` / `{ query, scope?, limit? }` | — |
| `audit-*` | theme, env, imports, i18n, bundle, seo and headers audits | `{ dir? }` (`seo`: `{ origin, paths }`, `headers`: `{ url? }`) | — |
| `list-tests` / `run-test` | the spec matching a source file, and its result | `{ dir? }` / `{ file }` | — |
| `list-mcp-tools` / `call-mcp-tool` | the aggregated toolset, read and called in place | — / `{ name, args }` | — |
| `push-runtime-event` / `get-runtime` / `clear-runtime` / `replay-request` | overlay event ring buffers and request replay | see [`USAGE.md`](USAGE.md) §5 | — |

### Usage via MCP

Point any MCP client (Devin / Claude / Qoder) at `POST <base>__mcp` to read the inbox, submit
comments and call every mounted panel's tools from outside the browser. The MCP Playground panel
lists the same set grouped by app, with per-tool argument counts and a copyable client config.

```bash
curl -s -X POST http://localhost:5199/__devtools/__mcp \
  -H 'Content-Type: application/json' -H 'Origin: http://localhost:5199' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{
        "name":"wrikka-vite-devtools_run-agent","arguments":{"arg0":{"commentId":"..."}}}}'
```

| tool group | examples | notes |
|---|---|---|
| `wrikka-vite-devtools_*` | comments, runs, scanners, audits, MCP and runtime RPCs | args are **positional** — `{"arg0": {…}}` |
| `devframes_plugin_*` | inspect, og, a11y, git, assets, terminals… | only mounted frames appear |
| `devframes_service_*` / `devframe_*` | git, open and shiki helpers | service-provided |

Full option table, RPC reference and troubleshooting: [`USAGE.md`](USAGE.md)

## Contributing

Dev setup, build order and the frame-client bundling constraints live in [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

Released under the [MIT](LICENSE.md) license.
