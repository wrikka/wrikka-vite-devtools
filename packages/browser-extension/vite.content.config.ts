// Second build pass: the content script. Chrome loads content_scripts as
// CLASSIC scripts — this must be ONE self-contained bundle with no imports
// and no shared chunk, so it gets its own config (see package.json "build").
// emptyOutDir is false so it does not wipe the first pass's output.

import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: { content: resolve(root, 'content.ts') },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
})
