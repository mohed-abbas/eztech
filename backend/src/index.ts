// Sentry is initialised by ./instrument.ts, preloaded via `node --import` in every start command
// (see package.json scripts, docker-compose.yml, Dockerfile.dev). Preloading is required under ESM so
// Sentry's auto-instrumentation patches Express/Prisma before they load — a top-level import is too late.
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
