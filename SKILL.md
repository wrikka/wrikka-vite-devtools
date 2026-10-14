---
name: use-wrikka-vite-devtools
description: Mount the Devframe devtools hub (add-on set + MCP) and the comment→agent overlay into any Vite project with the `wrikka-vite-devtools` plugin
argument-hint: "[vite-config-or-scope]"
related:
  - follow-tool-devfra
  - follow-tool-vite-devtools
  - follow-tool-vite
  - follow-tool-vite-plugins
  - follow-tool-tsdown
  - follow-lib-zod
  - follow-tool-pkg-new
---

## Goal

Use the `wrikka-vite-devtools` Vite plugin to mount a Devframe hub with the add-on set (`inspect`, `og`,
`a11y`, `git`, `assets`, `terminals`; opt-in: `data-inspector`, `code-server`, `unocss`), an in-app comment
overlay that starts an agent CLI on submit, and an aggregate MCP endpoint at `<base>__mcp`.

## Scope

- In: `src/` (plugin + devframe definition + RPC + overlay), `examples/playground/` (verification host)
- Out: general Devframe docs — use `follow-tool-devfra`; full option/RPC reference → `USAGE.md`

## Execute

### 1. Install in the target project

Preview releases come from pkg.pr.new (not published to npm):

```bash
bun add -D "wrikka-vite-devtools@https://pkg.pr.new/wrikka/wrikka-vite-devtools@<ref>"
```

### 2. Add to vite.config.ts

```ts
import { useWrikkaViteDevtools } from 'wrikka-vite-devtools/vite'

export default defineConfig({
  // must come before framework plugins (solid/vue/react) so the overlay injects first
  plugins: [useWrikkaViteDevtools()],
})
```

Options: `base` (`/__devframes/`), `plugins` (keys or `'all'`), `mcp` (`'auto'|true|false`), `auth`,
`build`, `quiet`, `overlay` (`false` drops the dock), `agent` (`{ driver: 'auto'|'claude'|'codex'|'opencode', autoRun }`),
`skillsRoots` (extra harness skill dirs).

### 3. Verify after mounting

- `http://localhost:<port>/__devframes/` — hub UI; every frame at `<base><id>/` must return 200
- Overlay bar (Comment / Ideas / Inbox / Pins / **Panels**) loads on an app page; **Panels** links to
  the hub, where the dock panels live — the bar never carries panel icons. In SSR apps (TanStack
  Start / Solid
  Start / Nuxt / SvelteKit) the document is streamed and Vite's `transformIndexHtml` never runs —
  the dev-only `wrikka-vite-devtools:ssr-inject` middleware inserts `<base>embedded.js` before `</body>`
  instead (browser `Accept` must include `text/html`; no `content-length` on the response)
- Hub dock icons are fetched at runtime from `api.iconify.design` by `@devframes/hub-ui`: offline or
  a blocked request blanks every dock glyph, which is not fixable from a Kit package (`docks.register`
  takes an icon *name*). Overlay glyphs are inline SVG and unaffected
- pick element → submit → status flips
  `queued` → `running` → `done`; logs stream on channel `agent-logs`
- Hub frame inbox at `<base>wrikka-vite-devtools/` — the frame client (`src/client/`, UnoCSS-styled) shows
  runner info, the submit form, live comment list (2 s poll), Re-run and streamed logs
- MCP: `POST <base>__mcp` with an `Origin` header matching the Vite server; `tools/list` aggregates
  `wrikka-vite-devtools_get-meta|scan-dir|list-comments|submit-comment|update-comment|delete-comment|run-agent|cancel-agent|runner-info|list-skills|save-capture|list-captures|generate-ideas`
  plus `devframes_plugin_*`, `devframes_service_git_*`

### 4. Develop in this repo

```bash
bun install
bun run build        # tsdown (pkg) → vite overlay build + CSS inline → vite client; tsdown clean:true wipes dist
bun run playground   # http://localhost:5199/__devframes/ — imports dist, rebuild after src edits
bun run typecheck
```

## Rules

- Only pass `plugins: 'all'` when `@devframes/plugin-code-server` is installed (optional peer)
- `unocss` is dock-only — it registers an iframe for `@unocss/vite`'s inspector at `/__unocss/`, it is not a devframe. UnoCSS's own devframe export goes to Vite's devtools API, never the hub, so without this key the inspector has no dock entry
- `data-inspector` is re-keyed to id `data-inspector` by the plugin — its native id contains colons and is not hub-mountable (DF8004)
- Services (`@devframes/service-{open,git,shiki}`) are self-provided by the plugins — never pass `services` into hub options
- The overlay bundle must be ONE self-contained file (`vite.overlay.config.ts` builds the Solid/UnoCSS
  lib with `codeSplitting: false`; `scripts/inline-overlay-css.ts` folds the emitted stylesheet into
  `index.mjs` and deletes the sibling `.css`); the hub serves `dirname(clientScript.importFrom)`
  under the *devframe's own* base (`<base><id>/__page-script/<file>`) — sibling assets would 404,
  never emit `inlineDynamicImports`
- The dock executor calls the page-script module's `default`, so the overlay entry
  (`src/overlay/main.tsx`) must export a callable `default` (guarded by
  `window.__WRIKKA_VITE_DEVTOOLS_OVERLAY__`); a side-effect-only module logs `exports no callable "default"`
- MCP `tools/call` arguments are positional — a single-object RPC signature arrives as `{"arg0": {…}}`;
  a flat object fails with `DF0043`
- Agent runs are driven from `process.cwd()` of the dev server — e2e agent checks live in `examples/playground` only
- Never disable `auth` on a shared or non-localhost machine

## Expected Outcome

- A host project gets the devtools hub, MCP tools and the comment→agent overlay with a single plugin line, no extra wiring
