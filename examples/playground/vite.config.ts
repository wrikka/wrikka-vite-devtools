import UnoCSS from 'unocss/vite'
import { useWrikkaViteDevtools } from 'wrikka-vite-devtools/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [UnoCSS(), useWrikkaViteDevtools({ plugins: 'all', auth: false })],
})
