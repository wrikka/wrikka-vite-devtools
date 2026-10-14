import { useDevfra } from 'devfra-plugins/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [useDevfra({ plugins: 'all', auth: false })],
})
