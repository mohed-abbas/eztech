// Dev-only GPS simulator (D-01). Standalone tsx script — NOT part of the app bundle.
//
// Authenticates as the rider assigned to a given order, connects via socket.io-client with the same
// JWT handshake a real rider uses, and emits `rider:position` along a Paris route every ~3-5s so the
// full live-tracking pipeline (rider:position -> Mongo upsert -> rider-moved broadcast) is demoable
// end-to-end without Ilia's real rider client. Mirrors how Phase 4's Stripe E2E was demoed live.
//
// Run with the backend running and a seeded assigned in-transit order:
//   npx tsx --env-file=.env scripts/gps-simulator.ts <orderId> [riderId]
// (or: npm run sim:gps -- <orderId> [riderId])
//
// It looks up the order's assigned riderId from Postgres and mints a token for that rider, so it
// passes the server-side assignment gate (T-05-07) exactly as the real rider would. Pass an explicit
// [riderId] only to override (e.g. to exercise the rejection path).

import { io } from 'socket.io-client';
import type { Socket as ClientSocket } from 'socket.io-client';
// Type-only import is erased at compile time (no env validation at load); the runtime value is
// dynamically imported inside main() AFTER the --help check so a bare `--help` needs no .env.
import type { prisma as Prisma } from '../src/lib/prisma.js';

// signAccessToken / prisma are imported lazily inside main() AFTER the --help check, so `--help`
// works even with an incomplete .env (signAccessToken transitively validates the zod env, ADR-007).

// Paris delivery route: warehouse (Bercy-ish) -> Eiffel Tower area. Lifted from the old
// pages/orders/[id].vue ROUTE polyline (named [lat, lng] pairs) before Plan 04 deletes them.
const ROUTE: ReadonlyArray<readonly [number, number]> = [
  [48.8447, 2.3799],
  [48.8461, 2.3712],
  [48.848, 2.364],
  [48.85, 2.356],
  [48.852, 2.349],
  [48.8538, 2.34],
  [48.8551, 2.332],
  [48.8563, 2.322],
  [48.8575, 2.311],
  [48.8584, 2.2945],
];

// Emit cadence: 3-5s (server throttle floor is >=1/s, Plan 03 — so every fix passes).
const MIN_INTERVAL_MS = 3000;
const MAX_INTERVAL_MS = 5000;
// Mirror the backend's env default (src/config/env.ts PORT default 3001); override via PORT.
const SERVER_URL = `http://localhost:${process.env['PORT'] ?? '3001'}`;

function jitter(): number {
  // small +/- ~0.0002 deg (~20m) wobble so a stationary->stepping path looks realistic.
  return (Math.random() - 0.5) * 0.0004;
}

function nextDelay(): number {
  return MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS);
}

async function resolveRiderId(
  prisma: typeof Prisma,
  orderId: string,
  override?: string,
): Promise<string> {
  if (override) return override;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { riderId: true },
  });
  if (!order) throw new Error(`order ${orderId} not found`);
  if (!order.riderId) {
    throw new Error(
      `order ${orderId} has no assigned rider — assign one (status rider_assigned/in_transit) before simulating`,
    );
  }
  return order.riderId;
}

async function main(): Promise<void> {
  const [, , orderId, riderIdArg] = process.argv;

  if (!orderId || orderId === '--help' || orderId === '-h') {
    console.log(
      [
        'GPS simulator (dev only)',
        '',
        'Usage: npx tsx --env-file=.env scripts/gps-simulator.ts <orderId> [riderId]',
        '',
        '  <orderId>  id of an assigned, in-transit order to stream positions for',
        '  [riderId]  optional override; defaults to the order\'s assigned rider',
        '',
        'Emits rider:position along a Paris route every ~3-5s. Ctrl-C to stop.',
      ].join('\n'),
    );
    process.exit(orderId ? 0 : 1);
  }

  // Lazy-load AFTER the help check — these transitively validate the zod env (ADR-007), which a
  // bare `--help` should not require. signAccessToken needs JWT_SECRET; prisma needs DATABASE_URL.
  const { signAccessToken } = await import('../src/middleware/auth.js');
  const { prisma } = await import('../src/lib/prisma.js');

  const riderId = await resolveRiderId(prisma, orderId, riderIdArg);
  const token = signAccessToken({ sub: riderId, role: 'rider' });

  console.log(`[sim] connecting to ${SERVER_URL} as rider ${riderId} for order ${orderId}`);

  const socket: ClientSocket = io(SERVER_URL, {
    auth: { token },
    transports: ['websocket'],
  });

  let step = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const emitNext = (): void => {
    const [baseLat, baseLng] = ROUTE[step % ROUTE.length]!;
    const lat = baseLat + jitter();
    const lng = baseLng + jitter();
    const accuracy = 5 + Math.random() * 10;

    socket.emit('rider:position', { orderId, lat, lng, accuracy });
    console.log(
      `[sim] emit rider:position #${step} -> { lat: ${lat.toFixed(5)}, lng: ${lng.toFixed(5)}, accuracy: ${accuracy.toFixed(1)} }`,
    );

    step += 1;
    // loop the route so the demo can run indefinitely.
    timer = setTimeout(emitNext, nextDelay());
  };

  socket.on('connect', () => {
    console.log(`[sim] connected (${socket.id}) — streaming positions, Ctrl-C to stop`);
    emitNext();
  });

  socket.on('connect_error', (err: Error) => {
    console.error(`[sim] connect_error: ${err.message} (bad token or assignment?)`);
  });

  socket.on('disconnect', (reason: string) => {
    console.log(`[sim] disconnected: ${reason}`);
  });

  const shutdown = (): void => {
    console.log('\n[sim] stopping…');
    if (timer) clearTimeout(timer);
    socket.disconnect();
    void prisma.$disconnect().finally(() => process.exit(0));
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err: unknown) => {
  console.error('[sim] fatal:', err instanceof Error ? err.message : err);
  // process exit tears down the (lazily-opened) prisma pool and socket.
  process.exit(1);
});
