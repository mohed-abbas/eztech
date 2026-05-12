import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Lightweight unit-test setup — does NOT boot Nuxt. Nuxt auto-imports used by the
// code under test ($fetch, useRuntimeConfig, useMock, useAuthStore, vue reactivity)
// are stubbed on globalThis in tests/setup.ts.
export default defineConfig({
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./app', import.meta.url)),
      '@': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    globals: true,
  },
})
