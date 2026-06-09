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
  // Umami analytics — inert unless a website id is provided (demo: docker-compose.observability.yml).
  app: {
    head: {
      script: process.env.NUXT_PUBLIC_UMAMI_WEBSITE_ID
        ? [
            {
              src: `${process.env.NUXT_PUBLIC_UMAMI_HOST || 'http://localhost:3002'}/script.js`,
              defer: true,
              'data-website-id': process.env.NUXT_PUBLIC_UMAMI_WEBSITE_ID,
            },
          ]
        : [],
    },
  },
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
    // server-only Sentry DSN — reaches GlitchTip over the compose network (glitchtip:8080). Inert if empty.
    sentryDsn: process.env.NUXT_SENTRY_DSN || '',
    public: {
      useMock: process.env.VITE_USE_MOCK === 'true',
      // browser-facing: client stores hit the backend via the host port mapping
      apiUrl: process.env.VITE_API_URL || 'http://localhost:3001/api',
      // browser-facing Sentry DSN — reaches GlitchTip via its host port (localhost:8000). Inert if empty.
      sentryDsn: process.env.NUXT_PUBLIC_SENTRY_DSN || '',
      umamiHost: process.env.NUXT_PUBLIC_UMAMI_HOST || '',
      umamiWebsiteId: process.env.NUXT_PUBLIC_UMAMI_WEBSITE_ID || ''
    }
  }
})
