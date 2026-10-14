import { resolve } from 'node:path'
import solid from 'vite-plugin-solid'
import UnoCSS from 'unocss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  // hub serves this page under /__devframes/<id>/ — absolute /assets would escape that route
  base: './',
  plugins: [solid(), UnoCSS(resolve(import.meta.dirname, 'uno.config.ts'))],
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
  },
})
