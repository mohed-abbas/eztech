import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { logger } from './lib/logger.js';
import { apiRouter } from './routes/index.js';
import { errorHandler } from './middleware/error.js';
import { notFoundHandler } from './middleware/notFound.js';

export function buildApp() {
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors()); // tighten allowed origins in a later phase
  // larger limit than the default 1mb so base64-encoded rider documents fit
  app.use(express.json({ limit: '8mb' }));

  // uploaded rider documents (licence / insurance proof)
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));
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
  app.use(errorHandler);

  return app;
}
