import type { AppSocket } from '../auth.js';
import { prisma } from '../../lib/prisma.js';
import { getMongo } from '../../lib/mongo.js';
import { ensureMongo } from './mongo-ready.js';
import { orderRoom } from '../rooms.js';
import { RIDER_MOVED } from '../events.js';
import { logger } from '../../lib/logger.js';

// subscribe:order handler (D-10, Pattern 4, TRACK-02/04).
// The client-supplied orderId is treated as an OPAQUE STRING — it is read off the payload and used
// only as a scalar `id` in the Prisma `where`, never spread into a filter object (NoSQL/operator
// injection guard, T-05-09). Ownership is verified against Postgres with the rule copied
// BYTE-FOR-BYTE from routes/orders.ts:215 before any room join (T-05-06). A non-owner gets
// `error {code:'FORBIDDEN'}` and is NOT joined. On success the socket joins `order:<id>` and the
// last-known Mongo position is emitted immediately as a named {lat,lng} rider-moved so the map is
// never blank (D-05/TRACK-04).

interface RiderPositionDoc {
  location: { type: 'Point'; coordinates: [number, number] };
  at: Date | string;
}

export function registerOrderHandler(socket: AppSocket): void {
  socket.on('subscribe:order', async (payload: unknown) => {
    try {
      // opaque-string guard: pull a string id, reject anything else (never an object/operator).
      const orderId = (payload as { orderId?: unknown })?.orderId;
      if (typeof orderId !== 'string' || orderId.length === 0) {
        socket.emit('error', { code: 'FORBIDDEN' });
        return;
      }

      const user = socket.data.user;
      if (!user) {
        socket.emit('error', { code: 'FORBIDDEN' });
        return;
      }

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { customerId: true, riderId: true },
      });

      // byte-identical to routes/orders.ts:215
      const { sub, role } = user;
      const allowed = !!order && (role === 'admin' || order.customerId === sub || order.riderId === sub);
      if (!allowed) {
        socket.emit('error', { code: 'FORBIDDEN' });
        return;
      }

      void socket.join(orderRoom(orderId));

      // last-known position from Mongo → immediate rider-moved (named fields, D-12). If Mongo is
      // unavailable the join still succeeds; the map simply stays blank until the first live fix.
      try {
        await ensureMongo();
        const doc = await getMongo()
          .db()
          .collection<RiderPositionDoc>('riderPositions')
          .findOne({ orderId });
        if (doc) {
          const [lng, lat] = doc.location.coordinates;
          const at = doc.at instanceof Date ? doc.at.toISOString() : String(doc.at);
          socket.emit(RIDER_MOVED, { lat, lng, at });
        }
      } catch (err) {
        logger.error({ err }, 'subscribe:order last-known lookup failed');
      }
    } catch (err) {
      logger.error({ err }, 'subscribe:order failed');
      socket.emit('error', { code: 'FORBIDDEN' });
    }
  });
}
