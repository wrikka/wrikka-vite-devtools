---
name: wrikka-vite-devtools
description: Vite plugin that mounts the Devframe hub, add-on frames, MCP endpoint and the comment→agent overlay
related:
  - follow-tool-devframe
  - follow-tool-vite
  - follow-tool-vite-plugins
  - follow-tool-tsdown
  - follow-lib-zod
  - follow-tool-pkg-new
  - git-commit-and-push
  - follow-tool-vite-devtools
---

## Goal

Ship and maintain `wrikka-vite-devtools` — one Vite plugin that gives any Vite app the Devframe devtools hub,
the add-on frames, an aggregate MCP endpoint, and an in-page comment overlay that hands work straight
to an agent CLI. Agents must be able to follow this file end to end without guessing.

## Scope

- In: `src/` (plugin, devframe definition, RPC, agent runner, overlay, frame SPA),
  `examples/playground/` (verification host), `README.md`, `USAGE.md`, `SKILL.md`, `.github/workflows/`
- Out: upstream Devframe behaviour (`follow-tool-devframe`), host-app integration in other repos,
  `dist/` and `node_modules/` (generated)

## Execute

### 1. Start Every Task

1. Read this file and `USAGE.md`, then check `git status` — this repo is a git submodule of
   `devin-skills`, so commit here first, then bump the gitlink in the parent.
2. Read `src/protocol.ts` before touching any RPC — schemas there are the single source of truth for
   both the server handlers and the overlay's plain-TS mirror (`src/overlay/api.ts`).

### 2. Run Commands

- `bun install` — deps (Bun; `npm`/`npx` are unusable on this host, PATH exceeds cmd.exe's 8191 chars)
- `bun run build` — `build:pkg` (tsdown → `dist/*.mjs` + dts) → `build:overlay`
  (vite `-c vite.overlay.config.ts` → `dist/overlay/index.mjs`, then `scripts/inline-overlay-css.ts`
  folds the generated stylesheet into that one file) → `build:client` (vite → `dist/client`)
- `bun run playground` — build, then serve `examples/playground` on `:5199`
  → hub `http://localhost:5199/__devframes/`
- `bun run typecheck` — `tsc --noEmit` over `src` + the build configs
- CI (`.github/workflows/publish.yml`): `bun install --frozen-lockfile` → `bun run build` →
  `bunx --bun pkg-pr-new publish` — no lint/test step, so typecheck + build are the gate

### 3. Follow Architecture

1. Layering: `vite.ts` (public plugin, options, frame selection) → `devframe.ts` (definition + RPC
   wiring) → `rpc/*` (one file per bounded context) → `agent-runner.ts` / `comment-store.ts` /
   `prompts.ts` (infrastructure). `index.ts` is the only barrel.
2. Client injection has two paths: the hub's `transformIndexHtml` (file-backed `index.html` only)
   and `ssr-inject.ts` — a dev-only middleware that patches `res.write`/`res.end` to insert
   `<base>embedded.js` before the first `</body>` of a streamed HTML response (6-byte hold-back for
   split tags, bail-out on non-HTML or `content-length`, dedup when the hub already injected).
   Keep the two paths idempotent against each other when touching either.
3. Overlay (`src/overlay/`) is browser-only and runs as a dock page-script, UI in Solid + UnoCSS:
   `host.ts` (single shadow host + inlined `<style>`) → `picker.ts` (capture-phase highlight) →
   `frameworks.ts` (element description) → `ui/` Solid components (`Toolbar` edge-attached bottom
   strip, `Panel` dialog shell, `Composer`, `Inbox`, `Ideas`, `Pins` annotations + bubbles,
   refreshed from the 5s poll) → `main.tsx` (`mountOverlay()` + guarded self-call). The picker
   stays imperative DOM (`picker.ts`, `anchor.ts`); only the chrome is Solid.
   `CommentStore.update` must replace items immutably — devframe shared state freezes them.
4. RPC ids are kebab-case `name` fields on `defineRpcFunction`; the same string is the client call id
   and the MCP suffix (`wrikka-vite-devtools_submit-comment`). Never rename without updating `USAGE.md` §5.
5. State lives in `CommentStore` (`comments.json` under the hub project storage dir) and mirrors into
   the devframe shared-state `comments` slice; agent output streams on the `agent-logs` channel.
6. New option surface goes through `UseWrikkaViteDevtoolsOptions` → `DevframeOptions`; keep both JSDoc'd, they
   are copied into `README.md` / `USAGE.md` tables.

### 4. Verify A Change

1. `bun run build && bun run typecheck` — both must be clean.
2. `bun run playground`, then in the browser: pick an element → comment with a skill + capture →
   Inbox shows the run streaming → status flips to `done`/`failed`.
3. `curl` the MCP endpoint with an `Origin` header and confirm `tools/list` contains every
   `wrikka-vite-devtools_*` id from `USAGE.md` §5.
4. Agent e2e (real CLI runs) happens **only** in `examples/playground` — never point a comment run at
   another repo.

### 5. Ship

1. `/git-commit-and-push` here → CI publishes a pkg.pr.new preview for the new sha.
2. Consume it in the host app (e.g. buuyook):
   `bun add -D wrikka-vite-devtools@https://pkg.pr.new/wrikka/wrikka-vite-devtools@<sha>` and place `useWrikkaViteDevtools()`
   **before** framework plugins in `vite.config.ts`, then restart the dev server.
3. Update the parent `devin-skills` submodule pointer after the commit lands.

## Rules

### 1. Format

- Frontmatter `name`, `description`, `related`; sections `## Goal` → `## Scope` → `## Execute` →
  `## Rules` → `## Expected Outcome`; under 250 lines; backticks for `tools`, `commands`, `paths`

### 2. Bundling Constraints

- The hub rewrites only the `clientScript.importFrom` specifier and serves that file's **directory**
  under `<base><id>/__page-script/` (the devframe's own base, not the hub base) — so the overlay
  bundle must be ONE fully self-contained file: `vite.overlay.config.ts` builds a lib with
  `codeSplitting: false`, and `scripts/inline-overlay-css.ts` replaces the `__OVERLAY_CSS_TOKEN__`
  string in `src/overlay/css.ts` with the emitted stylesheet and deletes the sibling `.css` asset
  (a sibling asset would 404).
- UnoCSS `presetWind4` defaults its colour/shadow vars via `@property` — ignored inside shadow
  roots — so `inline-overlay-css.ts` rewrites every `@property` into a
  `*,::before,::after{--name:initial-value}` fallback and keeps the preflight reset disabled
  (the host page must never be reset).
- The dock executor imports that URL and calls `mod[importName ?? 'default']`, so
  `src/overlay/main.tsx` must export a **callable default**; it also self-calls, and both paths
  share the `window.__WRIKKA_VITE_DEVTOOLS_OVERLAY__` guard. A side-effect-only module logs
  `exports no callable "default"`.
- `tsdown` `clean: true` deletes `dist/` — the `build` script order is load-bearing; never add a
  script that builds `client` before `pkg`.
- `devframe.ts` resolves `dist/overlay/index.mjs` at runtime, so the overlay entry name is fixed.
- The overlay mirrors protocol types in plain TS (`src/overlay/api.ts`) instead of importing `zod` —
  keep the browser bundle free of the server validator.
- The frame client (`src/client/`) is the hub-side inbox (comments panel, UnoCSS `presetWind4`,
  no shortcuts). Its vite build must keep `base: './'`, the explicit
  `UnoCSS(resolve(import.meta.dirname, 'uno.config.ts'))` path, and a `content.pipeline.include`
  matching plain `.ts` — each of the three fails silently otherwise (404 assets / default config /
  missing classes). See [`CONTRIBUTING.md`](CONTRIBUTING.md).

### 3. Code Conventions

- Files ≤250 lines, one responsibility each; a new RPC context gets its own `src/rpc/<context>.ts`
  factory returning `{ deps }`-closed functions, registered in `devframe.ts`
- Every RPC sets `jsonSerializable: true`, an `agent.description`, and zod `args`/`returns`
- No speculative public surface: an exported symbol needs a consumer in `src/`, `examples/`, or docs
- Host-side guardrails stay in options (`overlay: false`, `agent.autoRun: false`) — never branch on
  an env var inside the plugin

### 4. Safety

- `auth: false` disables the OTP gate — localhost single-user only, never on a shared machine
- Agent runs use `process.cwd()` of the dev server; keep prompts in `prompts.ts` so the exact
  instruction sent to a CLI is reviewable in one place
- Capture and comments are written under the hub storage dir; do not move them into the host app's
  source tree
- Do not edit upstream `@devframes/*` / `devframe` packages in `node_modules` as a fix — work around
  it in this repo and note the constraint here (e.g. the `data-inspector` re-key)

## Expected Outcome

- A host project gets hub + add-ons + MCP + overlay from one plugin line
- `bun run build` and `bun run typecheck` pass; playground shows a full comment→agent→done loop
- `USAGE.md`, `README.md` and `SKILL.md` match the real option and RPC surface
- Preview release published through pkg.pr.new and consumed by the host app
