import type { AppSocket } from '../auth.js';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { getMongo } from '../../lib/mongo.js';
import { ensureMongo } from './mongo-ready.js';
import { getIO } from '../../lib/socket.js';
import { orderRoom } from '../rooms.js';
import { RIDER_MOVED } from '../events.js';
import { logger } from '../../lib/logger.js';
import { dispatch } from '../../lib/notifications.js';
import { arrivalEvents, type GeofenceEvent, type GeofenceOrder } from '../../lib/geofence.js';

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

// one-shot guard so an arrival notification fires once per order+event rather than on every fix
// while the rider sits inside the geofence. Backed by the dispatch unique key for correctness
// across restarts; this in-memory Set just spares a DB round-trip on each position.
const firedGeofences = new Set<string>();

const GEOFENCE_COPY: Record<GeofenceEvent, { title: string; body: string }> = {
  rider_near_warehouse: {
    title: 'Votre commande est en cours de récupération',
    body: 'Le livreur est arrivé à l\'entrepôt pour récupérer votre commande.',
  },
  rider_near_customer: {
    title: 'Votre livreur arrive',
    body: 'Le livreur est tout proche de votre adresse de livraison.',
  },
};

// Fire a one-shot arrival notification for each geofence the rider has entered. Best-effort and
// fire-and-forget from the position handler — never couples the GPS path to notification delivery.
export async function checkGeofence(
  orderId: string,
  order: GeofenceOrder & { customerId: string | null },
  pos: { lat: number; lng: number },
): Promise<void> {
  if (!order.customerId) return;
  for (const event of arrivalEvents(order, pos)) {
    const key = `${orderId}:${event}`;
    if (firedGeofences.has(key)) continue;
    firedGeofences.add(key);
    try {
      await dispatch({
        userId: order.customerId,
        type: event,
        event,
        orderId,
        title: GEOFENCE_COPY[event].title,
        body: GEOFENCE_COPY[event].body,
        socketPush: true,
        essential: false, // informational arrival ping — respects emailOptOut (in-app + socket only)
      });
    } catch (err) {
      firedGeofences.delete(key); // let a later fix retry if the dispatch itself failed
      logger.error({ err, orderId, event }, 'geofence notify failed');
    }
  }
}

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

    // assignment gate — only the order's assigned rider may emit (orderId opaque string). Also pull
    // the geofence inputs (status + warehouse/customer coords) in the same read for arrival detection.
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        riderId: true, customerId: true, status: true,
        pickupLat: true, pickupLng: true, dropoffLat: true, dropoffLng: true,
      },
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

      // arrival geofence (Module 5) — fire-and-forget so notification delivery never couples to the
      // GPS path (same best-effort boundary as the broadcast). One-shot per order+event.
      void checkGeofence(orderId, order, { lat, lng });
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
