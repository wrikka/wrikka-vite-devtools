import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import UnoCSS from 'unocss/vite'
import { presetWind4 } from 'unocss'
import { unoPipelineInclude } from './src/uno-pipeline.ts'

// The hub serves dist/overlay/index.mjs verbatim as a dock page-script, so the
// bundle must be fully self-contained — lib mode with no externals, and the
// emitted CSS is folded into the JS by scripts/inline-overlay-css.ts.
export default defineConfig({
  plugins: [
    solid(),
    UnoCSS({
      presets: [presetWind4({ preflights: { reset: false } })],
      content: {
        pipeline: { include: unoPipelineInclude },
        filesystem: ['./src/overlay/**/*.{ts,tsx,css}', './src/ui/**/*.{ts,tsx,css}'],
      },
    }),
  ],
  build: {
    target: 'esnext',
    outDir: 'dist/overlay',
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: { entry: 'src/overlay/main.tsx', formats: ['es'], fileName: () => 'index.mjs' },
    rollupOptions: { output: { entryFileNames: 'index.mjs', codeSplitting: false } },
  },
})
