import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const frontendRoot = fileURLToPath(new URL('..', import.meta.url))

export default defineConfig({
  root: frontendRoot,
  plugins: [react()],
  test: {
    include: ['test/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'http://localhost:3000' } },
    setupFiles: ['test/setup/setup.ts'],
    css: false,
    testTimeout: 15_000,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/**/*.d.ts', 'src/types/**'],
      reportsDirectory: 'test/coverage',
      reporter: ['text', 'html', 'lcov'],
      thresholds: { lines: 90, functions: 85, branches: 80, statements: 90 },
    },
  },
})
