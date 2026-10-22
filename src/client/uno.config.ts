import { defineConfig, presetWind4, transformerDirectives, transformerVariantGroup } from 'unocss'
import { unoPipelineInclude } from '../uno-pipeline.ts'
import { themeColors } from '../ui/theme.ts'

export default defineConfig({
  // `theme` belongs to the config, not presetWind4 options: the preset ignores it silently.
  presets: [presetWind4()],
  theme: { colors: themeColors },
  transformers: [transformerVariantGroup(), transformerDirectives()],
  content: { pipeline: { include: unoPipelineInclude } },
})
