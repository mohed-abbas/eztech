import * as Sentry from '@sentry/node';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { logger } from './lib/logger.js';
import { apiRouter } from './routes/index.js';
import { webhooksRouter } from './routes/webhooks.js';
import { uploadsRouter } from './routes/uploads.js';
import { errorHandler } from './middleware/error.js';
import { notFoundHandler } from './middleware/notFound.js';
import { csrfProtection } from './middleware/csrf.js';
import { authLimiter } from './middleware/rateLimit.js';

export function buildApp() {
  const app = express();

  // Trust exactly one hop (nginx, the only reverse proxy in front of this container per the VPS
  // contract) so req.ip resolves from X-Forwarded-For rather than the nginx container's own IP.
  // A bare `true` would trust the whole chain and let a client spoof X-Forwarded-For to dodge the
  // rate limiter (T-08-05-02).
  app.set('trust proxy', 1);

  // Single-owner CSP rule (T-08-05-03): the browser-facing HTML Content-Security-Policy (with the
  // Umami/GlitchTip/Stripe/Leaflet allowlist) is owned exclusively by nginx on the frontend
  // catch-all (plan 08-07). This API serves JSON only — it never renders HTML — so it emits NO
  // Content-Security-Policy header at all, avoiding a second, competing/duplicated CSP on any
  // response nginx also decorates with its own header.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  // CORS_ORIGIN is a comma-separated allowlist (prod = https://eztech.thecodeman.cloud, set via
  // compose in plan 08-03). No wildcard fallback in prod — only the dev default below is permissive,
  // and that default is only ever reached when the env var is unset (local dev).
  const corsOrigins = (process.env['CORS_ORIGIN'] ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
    }),
  );
  // Thin express-rate-limit backstop on /api/auth (D-04) — see middleware/rateLimit.ts for why
  // nginx is primary. Never mounted on /socket.io/, which bypasses this Express app entirely.
  app.use('/api/auth', authLimiter);
  // Stripe webhook needs the UNPARSED body for signature verification, so it must be mounted
  // with express.raw BEFORE the global express.json and OUTSIDE the /api router (Pitfall 1).
  // Server-to-server (no browser Origin) — intentionally not in the CORS allowlist.
  app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }), webhooksRouter);

  // larger limit than the default 1mb so base64-encoded rider documents fit
  app.use(express.json({ limit: '8mb' }));

  // rider documents are PII — never served from a public static mount
  app.use('/uploads', uploadsRouter);
  app.use(
    pinoHttp({
      logger,
      redact: {
        paths: [
          'req.body.password',
          'req.body.currentPassword',
          'req.body.newPassword',
          'req.body.confirmPassword',
          'req.body.confirmNewPassword',
          'req.headers.authorization',
          'req.body.refreshToken',
        ],
        censor: '[REDACTED]',
      },
    }),
  );

  // CSRF guard runs after body parsing, before the API router. Cookie-authenticated unsafe
  // requests must carry a matching x-csrf-token (double-submit). The Stripe webhook is mounted
  // above (before express.json) and carries no session cookie, so it is unaffected.
  app.use('/api', csrfProtection);

  app.use('/api', apiRouter);

  // order matters: notFound only fires when no route matched, errorHandler must be last
  app.use(notFoundHandler);
  // capture unhandled errors to GlitchTip before our terminal handler swallows them.
  // No-op unless SENTRY_DSN is set (see instrument.ts).
  Sentry.setupExpressErrorHandler(app);
  app.use(errorHandler);

  return app;
}
