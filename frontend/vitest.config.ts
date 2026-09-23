import path from 'node:path'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { VitestReporter } from 'tdd-guard-vitest'
import { defineConfig } from 'vitest/config'

// The repo root, which is where `.claude/tdd-guard/data/` lives - not this
// directory. Vitest runs from `frontend/`, and the reporter's default is that
// path relative to the working directory, so without this it writes a
// `frontend/.claude/` that nothing reads. Derived the same way next.config.ts
// pins its tracing root, so it is right in any checkout rather than on one
// machine.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export default defineConfig({
  plugins: [react()],
  // Resolves the `@/*` alias straight from tsconfig.json, so Vitest and tsc can
  // never disagree about it.
  resolve: { tsconfigPaths: true },
  test: {
    // 'default' first, so the terminal output is unchanged; the second reporter
    // writes the run to `.claude/tdd-guard/data/test.json`, which is the only
    // evidence tdd-guard has that a test was ever run. Without it the guard
    // sees nothing and refuses every implementation edit as unproven.
    reporters: ['default', new VitestReporter({ projectRoot: repoRoot })],
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['src/lib/api/generated/**', 'node_modules/**', '.next/**'],
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**'],
      // Each `source.ts` is a fumadocs macro shell: it throws if imported outside the
      // bundler, so there is nothing here to cover.
      exclude: [
        'src/lib/api/generated/**',
        'src/**/*.d.ts',
        'src/app/**/layout.tsx',
        'src/lib/source.ts',
        'src/lib/blog/source.ts',
      ],
    },
  },
})
