// Server-side (Nitro) error tracking. Loaded by the @sentry/nuxt module.
// Inert unless NUXT_SENTRY_DSN is set. This DSN reaches GlitchTip over the compose
// network (glitchtip:8080), distinct from the browser DSN which uses the host port.
import * as Sentry from '@sentry/nuxt'

const dsn = process.env.NUXT_SENTRY_DSN || ''

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
  })
}
