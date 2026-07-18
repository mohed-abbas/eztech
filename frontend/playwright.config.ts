import { defineConfig, devices } from '@playwright/test'

// DEPLOY-10 smoke gate config. Runs against the already-running stack (dev or CI's
// docker-compose target) — no webServer block here, the CI e2e-smoke job (plan 08-08)
// owns starting the stack before invoking `playwright test`.
export default defineConfig({
  testDir: './e2e',
  // The CI stack runs the Nuxt DEV server, which compiles each route on its first request. The smoke
  // test walks several routes (login -> products -> product -> cart -> checkout -> profile), so under a
  // cold CI server the per-navigation compile cost adds up — give the whole test plenty of headroom.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  // One retry in CI: a retry re-runs against a now-warm dev server (routes compiled, Vite deps
  // pre-bundled), which absorbs residual first-hit cold-compile flakiness. Locally stays strict.
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    // Tolerate first-hit dev-server route compilation on navigations/actions.
    navigationTimeout: 30_000,
    actionTimeout: 15_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
