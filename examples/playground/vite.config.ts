import { resolve } from 'node:path'
import UnoCSS from 'unocss/vite'
import { useWrikkaViteDevtools } from 'wrikka-vite-devtools/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    // UnoCSS resolves its config next to the process cwd, which is the repo root
    // when the playground starts with `vite examples/playground`.
    UnoCSS(resolve(import.meta.dirname, 'uno.config.ts')),
    useWrikkaViteDevtools({ plugins: 'all', auth: false }),
  ],
})
