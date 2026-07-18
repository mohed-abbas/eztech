// Client-side error tracking (Sentry protocol — we self-host GlitchTip).
// Loaded by the @sentry/nuxt module. Inert unless a browser DSN is configured
// (NUXT_PUBLIC_SENTRY_DSN), so normal dev sends nothing. DSN points at GlitchTip's host port.
import * as Sentry from '@sentry/nuxt'

// (/api/geocode?q=...). On masque ce paramètre pour qu'aucune donnée personnelle ne parte dans les
// breadcrumbs GlitchTip.
function scrubGeocodeUrl(breadcrumb: Sentry.Breadcrumb): Sentry.Breadcrumb {
  const url = breadcrumb.data?.url
  if (typeof url === 'string' && url.includes('/api/geocode')) {
    breadcrumb.data!.url = url.replace(/([?&]q=)[^&]*/, '$1[redacted]')
  }
  return breadcrumb
}

const dsn = useRuntimeConfig().public.sentryDsn

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE || 'development',
    tracesSampleRate: 0.1,
    beforeBreadcrumb: scrubGeocodeUrl,
  })
}
