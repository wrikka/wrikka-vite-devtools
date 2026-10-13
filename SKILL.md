---
name: use-devfra
description: Mount the Devframe devtools hub (full add-on set + MCP) into any Vite project with the `use-devfra` plugin
argument-hint: "[vite-config-or-scope]"
related:
  - follow-tool-devframe
  - follow-tool-vite
  - follow-tool-vite-plugins
  - follow-lib-zod
---

## Goal

Use the `use-devfra` Vite plugin to mount a Devframe hub with the full add-on set (`inspect`, `og`,
`a11y`, `git`, `assets`, `terminals`; opt-in: `data-inspector`, `code-server`) into any Vite project,
with an aggregate MCP endpoint at `<base>__mcp` for agent clients.

## Scope

- In: `src/` (plugin + devframe definition + RPC), `examples/playground/` (verification host)
- Out: general Devframe docs — use `follow-tool-devframe`

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
  plugins: [useDevfra()], // dev-only: guard with a condition if you only want it on serve
})
```

Options: `base` (default `/__devframes/`), `plugins` (keys or `'all'`), `mcp` (`'auto'|true|false`),
`auth` (`false` disables the OTP gate — localhost single-user only), `build`, `quiet`.

### 3. Verify after mounting

- `http://localhost:<port>/__devframes/` — hub UI; every frame at `<base><id>/` must return 200
- MCP: `POST <base>__mcp` — must include an `Origin` header (vite origin check); `tools/list` then
  aggregates tools from every frame (`use-devfra_get-meta`, `use-devfra_scan-dir`, `devframes_plugin_*`,
  `devframes_service_git_*`)

### 4. Develop in this repo

```bash
bun install
bun run build        # tsdown first, then vite build client (tsdown clean:true wipes dist/client)
bun run playground   # http://localhost:5199/__devframes/ — playground imports dist, rebuild after src edits
bun run typecheck
```

## Rules

- Only pass `plugins: 'all'` when `@devframes/plugin-code-server` is installed (optional peer)
- `data-inspector` is re-keyed to id `data-inspector` by the plugin — its native id contains colons and is not hub-mountable (DF8004)
- Services (`@devframes/service-{open,git,shiki}`) are self-provided by the plugins — never pass `services` into hub options
- Never disable `auth` on a shared or non-localhost machine

## Expected Outcome

- A host project gets the devtools hub + MCP tools with a single plugin line, no extra wiring
