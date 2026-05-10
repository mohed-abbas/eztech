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

  app.use(helmet());
  app.use(cors()); // tighten allowed origins in a later phase
  app.use(express.json({ limit: '1mb' }));
  app.use(pinoHttp({ logger }));

  app.use('/api', apiRouter);

  // order matters: notFound only fires when no route matched, errorHandler must be last
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
