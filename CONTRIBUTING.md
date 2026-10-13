# Contributing

## Setup

```bash
bun install
bun run build      # build:pkg -> build:overlay -> build:client (order matters, see below)
bun run typecheck
```

## Build order

`bun run build` runs three steps, and they are **not** interchangeable:

1. `build:pkg` — `tsdown` builds `dist/{index,vite,devframe,rpc}.mjs` + `.d.mts`. Its config has
   `clean: true`, which **wipes `dist/`**, including the client bundle.
2. `build:overlay` — `tsdown -c tsdown.overlay.config.ts` builds `dist/overlay/index.mjs`.
3. `build:client` — `vite build src/client` outputs the frame SPA into `dist/client`.

Rebuilding `build:pkg` after the others deletes `dist/client`, so always finish with
`build:client` (or just run `bun run build`).

## Playground

```bash
bun run playground   # build + serve at http://localhost:5199
```

`examples/playground/vite.config.ts` imports `use-devfra/vite` from the **built** `dist`, not from
`src`. After any source edit, rebuild before checking behavior in the browser.

## Bundling constraints

Two invariants the hub relies on — breaking either produces silent failures, not build errors:

- **Overlay must be fully self-contained.** `dist/overlay/index.mjs` is served verbatim to app
  pages; the host template only rewrites the entry specifier, never transitive bare imports. That
  is why `tsdown.overlay.config.ts` sets `noExternal: [/.*/]`, and the module must export a
  callable `default`.
- **Frame client paths are relative.** The hub serves the page under `<base><id>/`, so
  `src/client/vite.config.ts` must keep `base: './'` (absolute `/assets` would escape the route)
  and pass the config explicitly: `UnoCSS(resolve(import.meta.dirname, 'uno.config.ts'))` — the
  client has its own UnoCSS config, the app root has none.

## Testing agent runs

Agent auto-run spawns real CLI processes (`claude` / `codex` / `opencode`) that edit the working
tree. Exercise comment → agent flows **only inside `examples/playground`**, never against a real
application repo.

## Conventions

- English in code, comments, and docs.
- The frame client uses UnoCSS `presetWind4` utilities directly — no `shortcuts`.
- Files stay ≤250 lines; split panels when they grow (see `src/client/comments-panel.ts`).
- `README.md` ships in the package (`files` in `package.json`) — update it with any user-facing
  change.
