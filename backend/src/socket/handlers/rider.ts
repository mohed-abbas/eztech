import type { AppSocket } from '../auth.js';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { getMongo } from '../../lib/mongo.js';
import { ensureMongo } from './mongo-ready.js';
import { getIO } from '../../lib/socket.js';
import { orderRoom } from '../rooms.js';
import { RIDER_MOVED } from '../events.js';
import { logger } from '../../lib/logger.js';

// rider:position handler (D-06/D-12/D-14, Pattern 5, TRACK-01/03).
//
// Trust boundary: the GPS payload is untrusted. Before any persist or broadcast the socket is gated
// to role==='rider' AND the order's assigned rider (T-05-07), the payload is bounds-validated
// (T-05-10), and a per-rider throttle caps writes to ≤1/s (T-05-08). The cross-store write order is
// Mongo upsert FIRST, then broadcast ONLY if the write succeeded (D-14 / Pitfall F): if the Mongo
// write throws, nothing is emitted. orderId is treated as an opaque string in the Prisma filter.

// per-rider last-write epoch ms — module-level so it survives across emits on the same connection.
const lastWrite = new Map<string, number>();
const THROTTLE_MS = 1000;

const positionSchema = z.object({
  orderId: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().optional(),
});

interface RiderPositionDoc {
  orderId: string;
  riderId: string;
  location: { type: 'Point'; coordinates: [number, number] };
  accuracy?: number;
  at: Date;
}

export function registerRiderHandler(socket: AppSocket): void {
  socket.on('rider:position', async (payload: unknown) => {
    const user = socket.data.user;
    if (!user || user.role !== 'rider') return;
    const sub = user.sub;

    // validate bounds + shape before touching any store.
    const parsed = positionSchema.safeParse(payload);
    if (!parsed.success) return;
    const { orderId, lat, lng } = parsed.data;
    const accuracy = parsed.data.accuracy;

    // throttle floor: at most one write+broadcast per second per rider.
    const now = Date.now();
    if (now - (lastWrite.get(sub) ?? 0) < THROTTLE_MS) return;

    // assignment gate — only the order's assigned rider may emit (orderId opaque string).
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { riderId: true },
    });
    if (!order || order.riderId !== sub) return;

    // reserve the throttle slot before the write so a flood within the window is suppressed even
    // while the write is in flight.
    lastWrite.set(sub, now);

    try {
      await ensureMongo();
      const at = new Date();
      // Mongo write FIRST (D-14). upsert-latest: one doc per active delivery (D-07).
      await getMongo()
        .db()
        .collection<RiderPositionDoc>('riderPositions')
        .replaceOne(
          { orderId, riderId: sub },
          {
            orderId,
            riderId: sub,
            location: { type: 'Point', coordinates: [lng, lat] },
            ...(accuracy !== undefined ? { accuracy } : {}),
            at,
          },
          { upsert: true },
        );

      // broadcast ONLY after the write succeeds — named {lat,lng} (D-12), never a bare array.
      getIO().to(orderRoom(orderId)).emit(RIDER_MOVED, { lat, lng, at: at.toISOString() });
    } catch (err) {
      // Mongo down / write failed → do NOT emit (Pitfall F). HTTP path is unaffected (D-14).
      logger.error({ err }, 'rider:position persist failed — broadcast suppressed');
    }
  });

  socket.on('disconnect', () => {
    const sub = socket.data.user?.sub;
    if (sub) lastWrite.delete(sub);
  });
}
