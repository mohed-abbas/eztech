// Sentry is initialised by ./instrument.ts, preloaded via `node --import` in every start command
// (see package.json scripts, docker-compose.yml, Dockerfile.dev). Preloading is required under ESM so
// Sentry's auto-instrumentation patches Express/Prisma before they load — a top-level import is too late.
import { createServer } from 'node:http';
import { buildApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { initMongo, closeMongo } from './lib/mongo.js';
import { initSocket } from './lib/socket.js';
import { startReturnReminders, stopReturnReminders } from './jobs/return-reminders.js';
import { startAssignmentExpiry, stopAssignmentExpiry } from './jobs/assignment-expiry.js';
import { startLateFees, stopLateFees } from './jobs/late-fees.js';

const app = buildApp();

// Attach Socket.io to the SAME http.Server as Express (D-08) — app.listen() can't share the server.
const server = createServer(app);

server.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'backend listening');
});

// Boot MongoDB NON-fatally: if Mongo is down the GPS layer is disabled but the HTTP API stays up (D-14/AP3).
initMongo(env.MONGODB_URI).catch((e) => logger.error({ e }, 'mongo init failed — GPS disabled'));
// Attach the realtime layer after the server is constructed (D-08). Never imported from instrument.ts.
initSocket(server);
// Return-reminder cron (NOTIF-03) — boots after the server is built, normal import graph.
startReturnReminders();
// Assignment-offer cron — ré-arme la fenêtre d'offre des commandes non prises (assignmentExpiresAt).
startAssignmentExpiry();
// Late-fee cron (Module 9) — auto-charges overdue rentals off_session.
startLateFees();

// graceful shutdown — give in-flight requests up to 10s to finish before forcing exit
function shutdown(signal: NodeJS.Signals) {
  logger.info({ signal }, 'shutting down');
  server.close(() => {
    // server.close() expects a sync (err?: Error) => void callback — the async shutdown work runs
    // in a detached IIFE instead of making the callback itself async (which would return a Promise
    // where http.Server expects void).
    void (async () => {
      stopReturnReminders();
      stopAssignmentExpiry();
      stopLateFees();
      await closeMongo();
      process.exit(0);
    })();
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
