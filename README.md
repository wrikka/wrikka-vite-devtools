> ![Status](https://img.shields.io/badge/status-in_development-red)

# wrikka-vite-devtools

[Devframe](https://devfra.me) devtools hub with all add-ons plus an in-page comment→agent workflow
as a **single Vite plugin** — add `useWrikkaViteDevtools()` to `vite.config.ts` and get the hub at
`/__devframes/`, the **Comments** hub tab, and an aggregate MCP endpoint for agents.

![vite](https://img.shields.io/badge/built%20with-vite-646cff) ![devframe](https://img.shields.io/badge/devframe-1.2.x-7b1fa2) ![agents](https://img.shields.io/badge/agent%20CLI-claude%20%7C%20codex%20%7C%20opencode-0097a7)

```text
+--------------------------------------------------------------------------+
| wrikka-vite-devtools: comment -> agent lifecycle (input -> process -> output)      |
|                                                                          |
|  1. PICK     overlay pill in any dev page: element | component | page    |
|              (or type the target directly in the hub Comments tab)       |
|  2. SUBMIT   submit-comment RPC -> CommentStore (comments.json, queued)  |
|  3. RUN      auto-run spawns claude / codex / opencode, prompt = stdin   |
|  4. WATCH    stdout streams on agent-logs -> live log in the hub Inbox   |
|  5. RESULT   exit 0 + "SUMMARY:" line -> done | failed + resultSummary   |
|                                                                          |
|  same store, same runners reachable from MCP: POST <base>__mcp           |
+--------------------------------------------------------------------------+
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
   # hub:        http://localhost:<port>/__devframes/
   # frame:      http://localhost:<port>/__devframes/wrikka-vite-devtools/
   # MCP:        POST http://localhost:<port>/__devframes/__mcp
   ```

4. Pin an agent driver (optional) — `'auto'` picks the first installed of claude → codex → opencode:

   ```ts
   useWrikkaViteDevtools({ agent: { driver: 'opencode', autoRun: true } })
   ```

5. Comment and watch — pick an element (or the whole page) from the overlay pill, write the request,
   submit. The agent starts immediately and its log streams into the hub **Comments** tab Inbox.

## Features

| Icon | Feature | Description | Benefit | Usage |
|:---:|---|---|---|---|
| ![c](https://api.iconify.design/mdi/comment-search-outline.svg?color=%231976d2&width=16) | Comment pill | Compact bottom-right pill (Solid + UnoCSS, shadow DOM) with the `element` / `component` / `page` picker, **Comment**, **Pins** and the hub link | Pick the node you mean without a screenshot, and without covering the page | open any dev page |
| ![n](https://api.iconify.design/mdi/map-marker-radius-outline.svg?color=%233949ab&width=16) | Pinned annotations | Numbered pins anchor to commented elements; click a pin for its bubble (body, status, agent result); **Pins** toggles them | see every open comment in its real page context | **Pins** button |
| ![h](https://api.iconify.design/mdi/view-dashboard-outline.svg?color=%23607d8b&width=16) | Hub shortcut | The hub link on the right of the pill opens the hub (`<hubBase>`) with the target page passed along; the base is read from the URL the hub served the pill from, so a hub under a custom base still resolves | reach every dock panel (UnoCSS, Vue, React, …) without typing a path | hub link on the pill |
| ![r](https://api.iconify.design/mdi/robot.svg?color=%237b1fa2&width=16) | Agent auto-run | A submitted comment spawns claude / codex / opencode with the prompt on stdin | idea → edited code without leaving the browser | `agent: { autoRun: true }` |
| ![i](https://api.iconify.design/mdi/inbox-arrow-down.svg?color=%2300796b&width=16) | Comments hub tab | The **Comments** dock page (`<base>wrikka-vite-devtools/`) is a tabbed panel — Inbox, New comment, Ideas, Diagnostics — with a submit form, live comment list (2 s poll), Re-run and streamed logs | drive the whole workflow from the hub, no page click needed | open `<base>wrikka-vite-devtools/` |
| ![s](https://api.iconify.design/mdi/server-network.svg?color=%23388e3c&width=16) | SSR injection | dev-only middleware patches the streamed HTML when `transformIndexHtml` never runs | works in TanStack Start / Nuxt / SvelteKit with no `index.html` | `overlay: true` (default) |
| ![l](https://api.iconify.design/mdi/layers.svg?color=%23f57c00&width=16) | Framework aware | Detects Solid / Vue / React / Nuxt / Svelte from runtime marks | the resolved component name goes into the agent prompt | mode `component` |
| ![k](https://api.iconify.design/mdi/lightning-bolt.svg?color=%23c2185b&width=16) | Skill picker | Attach harness skills (devin / claude / qoder global + project roots) to a comment | the agent follows your conventions | composer skill chips |
| ![p](https://api.iconify.design/mdi/camera.svg?color=%23303f9f&width=16) | Page capture | PNG snapshot (html-to-image) stored under the hub dir and referenced in the comment | the agent can open the real visual context | "capture page" checkbox |
| ![d](https://api.iconify.design/mdi/lightbulb-on.svg?color=%23ffa000&width=16) | Generate ideas | the agent proposes 6 cards (title / detail / impact); Apply prefills a comment | discover the next improvement while browsing | **Ideas** tab |
| ![m](https://api.iconify.design/mdi/hexagon-multiple.svg?color=%23d32f2f&width=16) | Hub + add-ons + MCP | inspect, og, a11y, git, assets, terminals (opt-in data-inspector, code-server, unocss) and one aggregate MCP endpoint | one plugin wires the whole devtool + agent chain | `plugins: 'all'` |

## Usage

### Usage via Vite plugin

```ts
useWrikkaViteDevtools({
  base: '/__devframes/',        // hub mount; each frame lives at <base><id>/
  plugins: 'all',               // or a list of plugin keys
  mcp: 'auto',                  // aggregate MCP endpoint at <base>__mcp
  auth: false,                  // close the OTP gate (localhost single-user)
  agent: { driver: 'auto', autoRun: true },
  skillsRoots: ['./.devin/skills'],
  overlay: true,
})
```

| api | description | options | default |
|---|---|---|---|
| `base` | hub mount path | any `/.../` path | `/__devframes/` |
| `plugins` | which add-on frames to mount | keys \| `'all'` | all except `data-inspector`, `code-server`, `unocss` |
| `mcp` | aggregate MCP endpoint | `boolean \| 'auto'` | `'auto'` |
| `auth` | hub OTP gate | `boolean` | hub gate on |
| `agent.driver` | which CLI runs comments/ideas | `'auto' \| 'claude' \| 'codex' \| 'opencode'` | `'auto'` |
| `agent.autoRun` | start agent on `kind: 'comment'` submit | `boolean` | `true` |
| `overlay` | inject the in-page comment pill | `boolean` | `true` |
| `skillsRoots` | directories scanned by `list-skills` | `string[]` | `defaultSkillRoots()` |

### Usage via the hub Comments tab (agent workflow)

<details>
<summary>Open <code>/__devframes/wrikka-vite-devtools/</code> and run the full comment → agent loop in the browser</summary>

The shipped panel SPA (UnoCSS `presetWind4`, no shortcuts) is a complete comments client with four
tabs: **Inbox** (labelled `Inbox (n)` with the open count; comment list polled every 2 s, status chips
plus a page filter and a `visible/total` counter, each card links its target page, Re-run per comment,
live `agent-logs` stream),
**New comment** (target form — page / mode / cssPath — plus the submit composer; the page field is
prefilled from the pill link or the page the pill last stashed on this origin, and an unwritten body
autosaves per page so a tab switch can't lose it), **Ideas**, and
**Diagnostics** (`runner-info`: active driver + every installed CLI). Comments created from the pill,
the panel form, or MCP all share one store. The panel is the hub **Comments** dock tab — the pill's
hub link opens it, and the URL above works directly.

```text
+----------------------------------------------------------------+
|  /__devframes/wrikka-vite-devtools/                            |
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
| `get-meta` | project/cwd/frames meta | — | — |
| `list-comments` / `submit-comment` / `update-comment` / `delete-comment` | comment store RPCs | see [`USAGE.md`](USAGE.md) §5 | — |
| `run-agent` / `cancel-agent` / `runner-info` | start/cancel a run / inspect drivers | `{ commentId }` / `{ commentId }` / — | — |
| `list-skills` | skills from all configured roots | — | — |
| `save-capture` / `list-captures` | PNG snapshot storage | `{ dataUrl, page }` | — |
| `generate-ideas` | agent-proposed idea cards | `{ page, focus? }` | — |

### Usage via MCP

Point any MCP client (Devin / Claude / Qoder) at `POST <base>__mcp` to read the inbox, submit
comments and start runs from outside the browser:

```bash
curl -s -X POST http://localhost:5199/__devframes/__mcp \
  -H 'Content-Type: application/json' -H 'Origin: http://localhost:5199' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{
        "name":"wrikka-vite-devtools_run-agent","arguments":{"arg0":{"commentId":"..."}}}}'
```

| tool group | examples | notes |
|---|---|---|
| `wrikka-vite-devtools_*` | one per RPC above | args are **positional** — `{"arg0": {…}}` |
| `devframes_plugin_*` | inspect, og, a11y, git… | only mounted frames appear |
| `devframes_service_git_*` | git status/log helpers | service self-provided |

Full option table, RPC reference and troubleshooting: [`USAGE.md`](USAGE.md)

## Contributing

Dev setup, build order and the frame-client bundling constraints live in [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

Released under the [MIT](LICENSE.md) license.
