// UnoCSS gates `content.filesystem` and transform-pipeline files through the same
// `pipeline.include` filter, whose default only matches [jt]sx. Shared by every
// config in this repo so class strings in plain .ts modules are never dropped.
export const unoPipelineInclude = [
  /\.(vue|svelte|[jt]sx?|mdx?|astro|elm|php|phtml|marko|html)($|\?)/,
]
