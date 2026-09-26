import { defineConfig } from 'vitest/config'

/**
 * Deliberately separate from `vite.config.js`.
 *
 * The app config pulls in a Figma JSON import and a build-time plugin that has
 * nothing to do with unit tests; keeping the two apart means `vitest` never has
 * to evaluate them. No `esbuild.jsx` override is needed — Vite 8 compiles TSX
 * with the automatic JSX runtime by default, which is what `lib/store.tsx`
 * relies on since it does not import the React default binding.
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    // Both extensions are listed because the TypeScript -> JavaScript migration
    // is in progress: source files move to .js/.jsx one batch at a time, so a
    // single-extension glob would silently discover zero tests and `npm test`
    // would exit 1. Narrow this to .js/.jsx once the last .ts file is converted.
    include: ['src/**/*.test.{js,jsx,ts,tsx}'],
  },
})
