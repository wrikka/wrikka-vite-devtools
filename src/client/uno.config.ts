import { defineConfig, presetWind4, transformerDirectives, transformerVariantGroup } from 'unocss'

export default defineConfig({
  presets: [presetWind4()],
  transformers: [transformerVariantGroup(), transformerDirectives()],
  // panel classes live in plain .ts modules — beyond the default pipeline's [jt]sx-only include
  content: {
    pipeline: {
      include: [/\.(vue|svelte|[jt]sx?|mdx?|astro|elm|php|phtml|marko|html)($|\?)/],
    },
  },
})
