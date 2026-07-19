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
//
// The single attempt is memoized as the in-flight PROMISE (not a boolean) so concurrent first
// callers — e.g. two sockets connecting near-simultaneously, both racing to init Mongo — all await
// the SAME initMongo() call. A boolean flag flipped synchronously before the first await let a
// second caller see "already attempted" and call getMongo() immediately, throwing "not initialized"
// even though the first attempt's connect() was still in flight.
let attempt: Promise<void> | null = null;

export async function ensureMongo(): Promise<void> {
  if (!attempt) attempt = initMongo(env.MONGODB_URI);
  await attempt;
}
