// Client-side error tracking (Sentry protocol — we self-host GlitchTip).
// Loaded by the @sentry/nuxt module. Inert unless a browser DSN is configured
// (NUXT_PUBLIC_SENTRY_DSN), so normal dev sends nothing. DSN points at GlitchTip's host port.
import * as Sentry from '@sentry/nuxt'

const dsn = useRuntimeConfig().public.sentryDsn

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
  })
}
