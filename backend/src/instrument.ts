// Error tracking (Sentry protocol — we self-host GlitchTip). Imported as the very first thing in
// index.ts so Sentry wraps before Express/Prisma load. Inert when SENTRY_DSN is unset, so normal dev
// and CI never send events. See docker-compose.observability.yml for the optional GlitchTip backend.
import * as Sentry from '@sentry/node';

const dsn = process.env['SENTRY_DSN'];

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env['NODE_ENV'] ?? 'development',
    // low trace sample rate — error events are always captured; this only governs performance spans
    tracesSampleRate: 0.1,
  });
}
