import { useWrikkaViteDevtools } from 'wrikka-vite-devtools/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [useWrikkaViteDevtools({ plugins: 'all', auth: false })],
})
