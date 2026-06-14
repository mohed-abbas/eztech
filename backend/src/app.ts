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

export function buildApp() {
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
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

  app.use('/api', apiRouter);

  // order matters: notFound only fires when no route matched, errorHandler must be last
  app.use(notFoundHandler);
  // capture unhandled errors to GlitchTip before our terminal handler swallows them.
  // No-op unless SENTRY_DSN is set (see instrument.ts).
  Sentry.setupExpressErrorHandler(app);
  app.use(errorHandler);

  return app;
}
