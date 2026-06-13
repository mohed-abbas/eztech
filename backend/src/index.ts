import './instrument.js'; // fallback init — the start command also preloads this via --import so Sentry
                          // auto-instruments Express/Prisma (a top-level import alone is too late under ESM)
import { buildApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';

const app = buildApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'backend listening');
});

// graceful shutdown — give in-flight requests up to 10s to finish before forcing exit
function shutdown(signal: NodeJS.Signals) {
  logger.info({ signal }, 'shutting down');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
