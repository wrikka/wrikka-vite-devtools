import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    vite: 'src/vite.ts',
    devframe: 'src/devframe.ts',
    rpc: 'src/rpc.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  external: [/^node:/, 'devframe', /^devframe\//, 'zod', 'vite', /^@devframes\//, 'use-devfra'],
})
