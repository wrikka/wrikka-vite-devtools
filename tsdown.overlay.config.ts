import { defineConfig } from 'tsdown'

// The dock page-script is served verbatim to app pages by the hub — the host
// template only rewrites the entry specifier, never transitive bare imports.
// So the overlay bundle must be fully self-contained (everything inlined).
export default defineConfig({
  entry: { index: 'src/overlay/main.ts' },
  format: ['esm'],
  dts: false,
  clean: true,
  noExternal: [/.*/],
  outDir: 'dist/overlay',
})
