import { defineConfig } from 'vitest/config'

/**
 * Deliberately separate from `vite.config.js`.
 *
 * The app config pulls in a Figma JSON import and a build-time plugin that has
 * nothing to do with unit tests; keeping the two apart means `vitest` never has
 * to evaluate them. No `esbuild.jsx` override is needed — Vite 8 compiles TSX
 * with the automatic JSX runtime by default, which is what `lib/store.jsx`
 * relies on since it does not import the React default binding.
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    // Every test file is now .js/.jsx. The glob used to list .ts/.tsx as well,
    // so a mid-migration state would not silently discover zero tests and exit 1.
    include: ['src/**/*.test.{js,jsx}'],
  },
})
