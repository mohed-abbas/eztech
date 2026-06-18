import { initMongo } from '../../lib/mongo.js';
import { env } from '../../config/env.js';

// Lazy, once-only Mongo bootstrap for the socket handlers.
//
// index.ts calls initMongo() at boot, but the socket handlers must not assume that has run (e.g. in
// the integration test harness, which constructs the Socket.io server directly without the index.ts
// boot path). ensureMongo() connects on first handler use and then never attempts to connect again:
// once the process has decided Mongo is up, a subsequent closeMongo() (graceful shutdown) leaves
// getMongo() throwing — which the handlers catch and treat as "GPS unavailable, do not emit"
// (D-14 / Pitfall F). The flag intentionally does NOT reset on closeMongo so the emit-only-on-write
// contract holds after the store is torn down.
let attempted = false;

export async function ensureMongo(): Promise<void> {
  if (attempted) return;
  attempted = true;
  await initMongo(env.MONGODB_URI);
}
