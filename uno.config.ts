import { defineConfig, presetWind3, transformerDirectives, transformerVariantGroup } from 'unocss'

// UnoCSS with the Tailwind CSS v3 compatible preset (presetWind3).
// Utility classes match Tailwind's naming, so you can use e.g.
// `flex items-center gap-2 px-4 py-2 rounded` directly in templates,
// and `@apply` / `@screen` inside <style> blocks (transformerDirectives).
export default defineConfig({
  presets: [
    presetWind3(),
  ],
  transformers: [
    transformerDirectives(),
    transformerVariantGroup(),
  ],
})
