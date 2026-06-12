// Server-side (Nitro) error tracking. Loaded by the @sentry/nuxt module.
// Inert unless NUXT_SENTRY_DSN is set. This DSN reaches GlitchTip over the compose
// network (glitchtip:8080), distinct from the browser DSN which uses the host port.
// Reads process.env (not useRuntimeConfig): this file is imported before the Nuxt runtime
// config is set up, so runtime config is not available here — process.env is the source.
import * as Sentry from '@sentry/nuxt'

const dsn = process.env.NUXT_SENTRY_DSN || ''

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  })
}
