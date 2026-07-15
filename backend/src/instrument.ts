// Error tracking (Sentry protocol — we self-host GlitchTip). Imported as the very first thing in
// index.ts so Sentry wraps before Express/Prisma load. Inert when SENTRY_DSN is unset, so normal dev
// and CI never send events. GlitchTip runs as a service in docker-compose.yml.
import * as Sentry from '@sentry/node';

const dsn = process.env['SENTRY_DSN'];

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env['NODE_ENV'] ?? 'development',
    // 100% : faible volume, et la démo doit voir chaque mesure de performance
    tracesSampleRate: 1.0,
  });
}
