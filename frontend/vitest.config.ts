import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  // Resolves the `@/*` alias straight from tsconfig.json, so Vitest and tsc can
  // never disagree about it.
  resolve: { tsconfigPaths: true },
  test: {
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
      exclude: ['src/lib/api/generated/**', 'src/**/*.d.ts', 'src/app/**/layout.tsx'],
    },
  },
})
