import { join } from 'node:path'
import { defineConfig, presetWind4, transformerDirectives, transformerVariantGroup } from 'unocss'
import { unoPipelineInclude } from '../../src/uno-pipeline.ts'
import { themeColors } from '../../src/ui/theme.ts'

// Same palette as the dock panels, so the playground host reads as one product.
const files = ['index.html', 'main.ts'].map((name) => join(import.meta.dirname, name))

export default defineConfig({
  presets: [presetWind4()],
  theme: { colors: themeColors },
  transformers: [transformerVariantGroup(), transformerDirectives()],
  content: { filesystem: files, pipeline: { include: unoPipelineInclude } },
})
