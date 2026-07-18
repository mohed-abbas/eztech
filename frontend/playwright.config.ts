import { defineConfig, devices } from '@playwright/test'

// DEPLOY-10 smoke gate config. Runs against the already-running stack (dev or CI's
// docker-compose target) — no webServer block here, the CI e2e-smoke job (plan 08-08)
// owns starting the stack before invoking `playwright test`.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
