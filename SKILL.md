---
name: use-devfra
description: Mount the Devframe devtools hub (add-on set + MCP) and the comment→agent overlay into any Vite project with the `use-devfra` plugin
argument-hint: "[vite-config-or-scope]"
related:
  - follow-tool-devframe
  - follow-tool-vite
  - follow-tool-vite-plugins
  - follow-tool-tsdown
  - follow-lib-zod
  - follow-tool-pkg-new
---

## Goal

Use the `use-devfra` Vite plugin to mount a Devframe hub with the add-on set (`inspect`, `og`,
`a11y`, `git`, `assets`, `terminals`; opt-in: `data-inspector`, `code-server`), an in-app comment
overlay that starts an agent CLI on submit, and an aggregate MCP endpoint at `<base>__mcp`.

## Scope

- In: `src/` (plugin + devframe definition + RPC + overlay), `examples/playground/` (verification host)
- Out: general Devframe docs — use `follow-tool-devframe`; full option/RPC reference → `USAGE.md`

## Execute

### 1. Install in the target project

Preview releases come from pkg.pr.new (not published to npm):

```bash
bun add -D "use-devfra@https://pkg.pr.new/newkub/use-devfra@<ref>"
```

### 2. Add to vite.config.ts

```ts
import { useDevfra } from 'use-devfra/vite'

export default defineConfig({
  // must come before framework plugins (solid/vue/react) so the overlay injects first
  plugins: [useDevfra()],
})
```

Options: `base` (`/__devframes/`), `plugins` (keys or `'all'`), `mcp` (`'auto'|true|false`), `auth`,
`build`, `quiet`, `overlay` (`false` drops the dock), `agent` (`{ driver: 'auto'|'claude'|'codex'|'opencode', autoRun }`),
`skillsRoots` (extra harness skill dirs).

### 3. Verify after mounting

- `http://localhost:<port>/__devframes/` — hub UI; every frame at `<base><id>/` must return 200
- Overlay bar (Comment / Ideas / Inbox) loads on an app page; pick element → submit → status flips
  `queued` → `running` → `done`; logs stream on channel `agent-logs`
- MCP: `POST <base>__mcp` with an `Origin` header matching the Vite server; `tools/list` aggregates
  `use-devfra_get-meta|scan-dir|list-comments|submit-comment|update-comment|run-agent|runner-info|list-skills|save-capture|list-captures|generate-ideas`
  plus `devframes_plugin_*`, `devframes_service_git_*`

### 4. Develop in this repo

```bash
bun install
bun run build        # tsdown (pkg + overlay) then vite build client; tsdown clean:true wipes dist
bun run playground   # http://localhost:5199/__devframes/ — imports dist, rebuild after src edits
bun run typecheck
```

## Rules

- Only pass `plugins: 'all'` when `@devframes/plugin-code-server` is installed (optional peer)
- `data-inspector` is re-keyed to id `data-inspector` by the plugin — its native id contains colons and is not hub-mountable (DF8004)
- Services (`@devframes/service-{open,git,shiki}`) are self-provided by the plugins — never pass `services` into hub options
- The overlay bundle must be self-contained (`tsdown.overlay.config.ts` inlines every bare import);
  the hub serves `dirname(clientScript.importFrom)` under the *devframe's own* base
  (`<base><id>/__page-script/<file>`), so rolldown sibling chunks resolve — never emit `inlineDynamicImports`
- The dock executor calls the page-script module's `default`, so the overlay entry must export a
  callable `default` (guarded by `window.__DEVFRA_OVERLAY__`); a side-effect-only module logs
  `exports no callable "default"`
- MCP `tools/call` arguments are positional — a single-object RPC signature arrives as `{"arg0": {…}}`;
  a flat object fails with `DF0043`
- Agent runs are driven from `process.cwd()` of the dev server — e2e agent checks live in `examples/playground` only
- Never disable `auth` on a shared or non-localhost machine

## Expected Outcome

- A host project gets the devtools hub, MCP tools and the comment→agent overlay with a single plugin line, no extra wiring
