import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

const frontendRoot = fileURLToPath(new URL('../..', import.meta.url))
const API_PORT = 5055
const WEB_PORT = 5391

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  outputDir: './results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { outputFolder: './report', open: 'never' }]],
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    // Uses the locally installed Chrome, so no browser download is needed.
    channel: 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'mobile', use: { ...devices['Pixel 7'], channel: 'chrome' }, testMatch: '**/responsive.spec.ts' },
  ],
  webServer: [
    {
      command: 'node test/e2e/start-backend.mjs',
      cwd: frontendRoot,
      url: `http://localhost:${API_PORT}/api/health`,
      env: { E2E_API_PORT: String(API_PORT) },
      reuseExistingServer: false,
      timeout: 180_000, // first run may download the MongoDB binary
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      // Test the production build (vite preview reuses server.proxy), which also avoids
      // dev-server dependency re-optimization reloads mid-test.
      command: `npx vite build --outDir test/e2e/.dist --emptyOutDir && npx vite preview --outDir test/e2e/.dist --port ${WEB_PORT} --strictPort`,
      cwd: frontendRoot,
      url: `http://localhost:${WEB_PORT}`,
      env: { VITE_API_PROXY_TARGET: `http://localhost:${API_PORT}` },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
