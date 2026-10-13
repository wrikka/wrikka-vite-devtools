import { useDevfra } from 'use-devfra/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [useDevfra({ plugins: 'all', auth: false })],
})
