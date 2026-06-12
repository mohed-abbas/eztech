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
  ],
  css: ['~/assets/css/tailwind.css'],
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
    public: {
      useMock: process.env.VITE_USE_MOCK === 'true',
      // browser-facing: client stores hit the backend via the host port mapping
      apiUrl: process.env.VITE_API_URL || 'http://localhost:3001/api'
    }
  }
})
