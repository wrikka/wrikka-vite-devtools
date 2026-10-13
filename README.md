> ![Status](https://img.shields.io/badge/status-in_development-red)

# use-devfra

[Devframe](https://devfra.me) devtools hub with all add-ons plus an in-page comment→agent workflow
as a **single Vite plugin** — add `useDevfra()` to `vite.config.ts` and get the hub at
`/__devframes/`, the **Comment** frame inbox, and an aggregate MCP endpoint for agents.

![vite](https://img.shields.io/badge/built%20with-vite-646cff) ![devframe](https://img.shields.io/badge/devframe-1.2.x-7b1fa2) ![agents](https://img.shields.io/badge/agent%20CLI-claude%20%7C%20codex%20%7C%20opencode-0097a7)

```text
+--------------------------------------------------------------------------+
| use-devfra: comment -> agent lifecycle (input -> process -> output)      |
|                                                                          |
|  1. PICK     overlay bar in any dev page: element | component | page     |
|              (or type directly into the hub frame form)                  |
|  2. SUBMIT   submit-comment RPC -> CommentStore (comments.json, queued)  |
|  3. RUN      auto-run spawns claude / codex / opencode, prompt = stdin   |
|  4. WATCH    stdout streams on agent-logs -> live log in Inbox + frame   |
|  5. RESULT   exit 0 + "SUMMARY:" line -> done | failed + resultSummary   |
|                                                                          |
|  same store, same runners reachable from MCP: POST <base>__mcp           |
+--------------------------------------------------------------------------+
```

## Get Started

1. Install — previews ship from pkg.pr.new (the package is not on npm):

   ```bash
   bun add -D "use-devfra@https://pkg.pr.new/newkub/use-devfra@<ref>"
   ```

2. Add the plugin — it must come **before** framework plugins that transform the HTML/SSR entry
   (`tanstackStart()`, `solid()`, …):

   ```ts
   // vite.config.ts
   import { useDevfra } from 'use-devfra/vite'

   export default defineConfig({
     plugins: [useDevfra({ auth: false }), solid(), tanstackStart()],
   })
   ```

3. Start your dev server and open the hub:

   ```bash
   bun run dev
   # hub:        http://localhost:<port>/__devframes/
   # frame:      http://localhost:<port>/__devframes/use-devfra/
   # MCP:        POST http://localhost:<port>/__devframes/__mcp
   ```

4. Pin an agent driver (optional) — `'auto'` picks the first installed of claude → codex → opencode:

   ```ts
   useDevfra({ agent: { driver: 'opencode', autoRun: true } })
   ```

5. Comment and watch — pick an element (or the whole page) in the overlay bar, write the request,
   submit. The agent starts immediately and its log streams into the overlay Inbox and the hub
   frame inbox.

## Features

| Icon | Feature | Description | Benefit | Usage |
|:---:|---|---|---|---|
| ![c](https://api.iconify.design/mdi/comment-search-outline.svg?color=%231976d2&width=16) | Comment overlay | Shadow-DOM bar with `element` / `component` / `page` pickers | Feedback lands on the exact node, not a screenshot | click **Comment** in any page |
| ![r](https://api.iconify.design/mdi/robot.svg?color=%237b1fa2&width=16) | Agent auto-run | A submitted comment spawns claude / codex / opencode with the prompt on stdin | idea → edited code without leaving the browser | `agent: { autoRun: true }` |
| ![i](https://api.iconify.design/mdi/inbox-arrow-down.svg?color=%2300796b&width=16) | Comment frame inbox | The **Comment** frame page (`<base>use-devfra/`) has a submit form, live comment list (2 s poll), Re-run and streamed logs | drive the whole workflow from the hub, no page click needed | open `<base>use-devfra/` |
| ![s](https://api.iconify.design/mdi/server-network.svg?color=%23388e3c&width=16) | SSR injection | dev-only middleware patches the streamed HTML when `transformIndexHtml` never runs | works in TanStack Start / Nuxt / SvelteKit with no `index.html` | `overlay: true` (default) |
| ![l](https://api.iconify.design/mdi/layers.svg?color=%23f57c00&width=16) | Framework aware | Detects Solid / Vue / React / Nuxt / Svelte from runtime marks | the resolved component name goes into the agent prompt | mode `component` |
| ![k](https://api.iconify.design/mdi/lightning-bolt.svg?color=%23c2185b&width=16) | Skill picker | Attach harness skills (devin / claude / qoder global + project roots) to a comment | the agent follows your conventions | composer skill chips |
| ![p](https://api.iconify.design/mdi/camera.svg?color=%23303f9f&width=16) | Page capture | PNG snapshot (html-to-image) stored under the hub dir and referenced in the comment | the agent can open the real visual context | "capture page" checkbox |
| ![d](https://api.iconify.design/mdi/lightbulb-on.svg?color=%23ffa000&width=16) | Generate ideas | the agent proposes 6 cards (title / detail / impact); Apply prefills a comment | discover the next improvement while browsing | **Ideas** tab |
| ![m](https://api.iconify.design/mdi/hexagon-multiple.svg?color=%23d32f2f&width=16) | Hub + add-ons + MCP | inspect, og, a11y, git, assets, terminals (opt-in data-inspector, code-server) and one aggregate MCP endpoint | one plugin wires the whole devtool + agent chain | `plugins: 'all'` |

## Usage

### Usage via Vite plugin

```ts
useDevfra({
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
| `plugins` | which add-on frames to mount | keys \| `'all'` | all except `code-server` |
| `mcp` | aggregate MCP endpoint | `boolean \| 'auto'` | `'auto'` |
| `auth` | hub OTP gate | `boolean` | hub gate on |
| `agent.driver` | which CLI runs comments/ideas | `'auto' \| 'claude' \| 'codex' \| 'opencode'` | `'auto'` |
| `agent.autoRun` | start agent on `kind: 'comment'` submit | `boolean` | `true` |
| `overlay` | inject the in-page comment bar | `boolean` | `true` |
| `skillsRoots` | directories scanned by `list-skills` | `string[]` | `defaultSkillRoots()` |

### Usage via the hub frame (agent workflow)

<details>
<summary>Open <code>/__devframes/use-devfra/</code> and run the full comment → agent loop in the browser</summary>

The shipped frame SPA (UnoCSS `presetWind4`, no shortcuts) is a complete comments client: it shows
the active driver from `runner-info`, a submit form (kind / mode / cssPath / page / skills), the
comment list polled every 2 s, a Re-run button per comment, and the live `agent-logs` stream
under each running card. Comments created from the overlay, the frame form, or MCP all share one
store. The frame has no dock-bar button — its entry points are the in-page overlay bar and the
URL above.

```text
+----------------------------------------------------------------+
|  /__devframes/use-devfra/                                      |
|  runner: driver: opencode - installed: claude, codex, opencode |
|  +-------------------------+  +------------------------------+ |
|  | New comment             |  | Comments (poll every 2 s)    | |
|  | kind [comment   v]      |  | [queued]  Move filters up    | |
|  | mode [page      v]      |  | [running] Add empty state    | |
|  | skills [x a11y]         |  | [done]    Fix header Re-run  | |
|  |            [ Submit ]   |  | > live agent-logs stream     | |
|  +-------------------------+  +------------------------------+ |
+----------------------------------------------------------------+
```

The agent pattern — drive every run with **opencode** (or any installed CLI) through the frame:

```ts
// vite.config.ts — pin the driver used by auto-run, Re-run and generate-ideas
useDevfra({ agent: { driver: 'opencode' } })
```

1. The header line comes from `runner-info` — `driver: opencode` confirms the pin; `available`
   lists every installed CLI.
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

### Usage via frame client API

```ts
import { connectDevframe } from 'devframe/client'

const scope = (await connectDevframe()).scope('use-devfra')
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
| `list-comments` / `submit-comment` / `update-comment` | comment store RPCs | see [`USAGE.md`](USAGE.md) §5 | — |
| `run-agent` / `runner-info` | start a run / inspect drivers | `{ commentId }` / — | — |
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
        "name":"use-devfra_run-agent","arguments":{"arg0":{"commentId":"..."}}}}'
```

| tool group | examples | notes |
|---|---|---|
| `use-devfra_*` | one per RPC above | args are **positional** — `{"arg0": {…}}` |
| `devframes_plugin_*` | inspect, og, a11y, git… | only mounted frames appear |
| `devframes_service_git_*` | git status/log helpers | service self-provided |

Full option table, RPC reference and troubleshooting: [`USAGE.md`](USAGE.md)

## Contributing

Dev setup, build order and the frame-client bundling constraints live in [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

Released under the [MIT](LICENSE.md) license.
