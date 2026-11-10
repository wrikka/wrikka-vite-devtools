import { defineConfig, type Plugin } from 'vite'
import { copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = dirname(fileURLToPath(import.meta.url))

// MV3 needs manifest.json next to the compiled JS in dist/.
function copyManifest(): Plugin {
  return {
    name: 'wrikka-copy-manifest',
    apply: 'build',
    writeBundle() {
      copyFileSync(resolve(root, 'manifest.json'), resolve(root, 'dist', 'manifest.json'))
    },
  }
}

export default defineConfig({
  plugins: [copyManifest()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(root, 'popup.html'),
        background: resolve(root, 'background.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
})
