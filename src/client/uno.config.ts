import { defineConfig, presetWind4, transformerDirectives, transformerVariantGroup } from 'unocss'
import { unoPipelineInclude } from '../uno-pipeline.ts'

export default defineConfig({
  presets: [presetWind4()],
  transformers: [transformerVariantGroup(), transformerDirectives()],
  content: { pipeline: { include: unoPipelineInclude } },
})
