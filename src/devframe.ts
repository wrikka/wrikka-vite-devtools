import { resolve } from 'node:path'
import { defineDevframe } from 'devframe'
import pkg from '../package.json'
import { getMeta, scanDir } from './rpc'

const clientAssets = resolve(import.meta.dirname, 'client')

export const devframeDefinition = defineDevframe({
  id: 'use-devfra',
  name: 'Use Devfra',
  version: pkg.version,
  packageName: pkg.name,
  importMetaUrl: import.meta.url,
  homepage: pkg.homepage ?? 'https://devfra.me',
  description: pkg.description ?? 'Devframe hub as a Vite plugin',
  icon: 'ph:cube-duotone',
  clientAssets,
  capabilities: { dev: true, build: true },
  setup(ctx) {
    const us = ctx.scope('use-devfra')
    us.rpc.register(getMeta)
    us.rpc.register(scanDir)
  },
})

export default devframeDefinition
