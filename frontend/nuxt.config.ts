import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: [
    '@nuxt/eslint',
    '@nuxt/fonts',
    '@nuxt/icon',
    'shadcn-nuxt',
    '@vueuse/motion/nuxt',
    '@pinia/nuxt',
    '@sentry/nuxt/module',
  ],
  css: ['~/assets/css/tailwind.css'],
  // Self-hosted GlitchTip (Sentry protocol). Inert at runtime unless a DSN is set (see the
  // sentry.*.config.ts files). top-level-import ensures the Nitro server is actually instrumented;
  // source-map upload is off because we self-host and have no Sentry SaaS auth token.
  sentry: {
    autoInjectServerSentry: 'top-level-import',
    sourceMapsUploadOptions: { enabled: false },
  },
  sourcemap: { client: 'hidden' },
  vite: {
    plugins: [tailwindcss()]
  },
  shadcn: {
    prefix: '',
    componentDir: './app/components/ui'
  },
  runtimeConfig: {
    // server-only: used by the Nuxt BFF (server/api/*) to reach the backend.
    // In Docker this is the compose service name; on the host it defaults to localhost.
    apiUrl: process.env.NUXT_API_URL || 'http://localhost:3001/api',
    // D-07: delivery fee is a server-side single source of truth, surfaced to the cart via /api/config
    deliveryFee: Number(process.env.NUXT_DELIVERY_FEE ?? 4.99),
    // (the server-side Sentry DSN is read from process.env.NUXT_SENTRY_DSN directly in
    // sentry.server.config.ts — that file loads before runtime config is available.)
    public: {
      useMock: process.env.VITE_USE_MOCK === 'true',
      // browser-facing: client stores hit the backend via the host port mapping
      apiUrl: process.env.VITE_API_URL || 'http://localhost:3001/api',
      // Stripe publishable key — public by design; the secret key never leaves the backend
      stripePublishableKey: process.env.VITE_STRIPE_PUBLISHABLE_KEY || '',
      // browser-facing Sentry DSN — reaches GlitchTip via its host port (localhost:8000). Inert if empty.
      sentryDsn: process.env.NUXT_PUBLIC_SENTRY_DSN || '',
      umamiHost: process.env.NUXT_PUBLIC_UMAMI_HOST || '',
      umamiWebsiteId: process.env.NUXT_PUBLIC_UMAMI_WEBSITE_ID || '',
      // Panne de paiement simulée (démo GlitchTip) : proportion de tentatives qui échouent. 0 = désactivé.
      paymentFailRate: Number(process.env.NUXT_PUBLIC_PAYMENT_FAIL_RATE ?? 0.33)
    }
  }
})
