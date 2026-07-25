import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { User } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import {
  UpdateRiderProfileSchema,
  RiderStatusSchema,
  UploadRiderDocumentSchema,
  MAX_DOC_BYTES,
} from '../schemas/rider.js';
import { notify, dispatch } from '../lib/notifications.js';
import { riderAssignedEmail } from '../lib/email/templates.js';
import { getIO } from '../lib/socket.js';
import { orderRoom } from '../socket/rooms.js';
import { ORDER_STATUS } from '../socket/events.js';

export const riderRouter = Router();

// base frontend origin for CTA links in transactional email — mirrors app.ts's CORS_ORIGIN
// parsing (first entry is the primary frontend origin); no dedicated FRONTEND_URL env exists.
const FRONTEND_ORIGIN = (process.env['CORS_ORIGIN'] ?? 'http://localhost:3000').split(',')[0]!.trim();

// every route here is rider-only
riderRouter.use(requireAuth, requireRole('rider'));

const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads', 'rider-documents');

// strip secrets and expose only what a rider needs to see about themselves
function buildRiderProfile(user: User, totalDeliveries: number) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    vehicleType: user.vehicleType,
    licenseNumber: user.licenseNumber,
    insuranceNumber: user.insuranceNumber,
    applicationStatus: user.riderApplicationStatus,
    online: user.riderOnline,
    totalDeliveries,
    createdAt: user.createdAt,
  };
}

async function getRiderOr401(riderId: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id: riderId } });
  // distinct reason so the frontend can clear the session without attempting refresh
  if (!user || user.role !== 'rider') throw new HttpError(401, 'user_revoked');
  return user;
}

// onboarding gate — a rider whose application is not approved cannot work
function assertApproved(user: User): void {
  if (user.riderApplicationStatus !== 'approved') {
    throw new HttpError(403, 'application_not_approved', { applicationStatus: user.riderApplicationStatus });
  }
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

// GET /api/rider/profile
riderRouter.get('/profile', async (req, res, next) => {
  try {
    const riderId = req.user!.sub;
    const [user, totalDeliveries] = await Promise.all([
      getRiderOr401(riderId),
      prisma.order.count({ where: { riderId, status: 'delivered' } }),
    ]);
    res.json({ profile: buildRiderProfile(user, totalDeliveries) });
  } catch (err) {
    next(err);
  }
});

// PUT /api/rider/profile
riderRouter.put('/profile', async (req, res, next) => {
  const result = UpdateRiderProfileSchema.safeParse(req.body);
  if (!result.success) return next(new HttpError(422, 'validation_failed', { issues: result.error.issues }));

  try {
    const riderId = req.user!.sub;
    const data = Object.fromEntries(
      Object.entries(result.data).filter(([, v]) => v !== undefined),
    );
    const user = await prisma.user.update({ where: { id: riderId }, data });
    const totalDeliveries = await prisma.order.count({ where: { riderId, status: 'delivered' } });
    res.json({ profile: buildRiderProfile(user, totalDeliveries) });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/rider/status — online/offline toggle
riderRouter.patch('/status', async (req, res, next) => {
  const result = RiderStatusSchema.safeParse(req.body);
  if (!result.success) return next(new HttpError(422, 'validation_failed', { issues: result.error.issues }));

  try {
    const riderId = req.user!.sub;
    if (result.data.online) {
      // can only go online once the onboarding application is approved
      const rider = await getRiderOr401(riderId);
      assertApproved(rider);
    }
    const user = await prisma.user.update({
      where: { id: riderId },
      data: { riderOnline: result.data.online },
    });
    res.json({ online: user.riderOnline });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

// detect the real file type from magic bytes; returns null when nothing matches
function sniffDocMime(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return 'image/png';
  if (
    buf.length >= 12 &&
    buf.slice(0, 4).toString('ascii') === 'RIFF' &&
    buf.slice(8, 12).toString('ascii') === 'WEBP'
  ) return 'image/webp';
  if (buf.length >= 5 && buf.slice(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  return null;
}

// POST /api/rider/documents — upload license / insurance proof (base64 body)
riderRouter.post('/documents', async (req, res, next) => {
  const result = UploadRiderDocumentSchema.safeParse(req.body);
  if (!result.success) return next(new HttpError(422, 'validation_failed', { issues: result.error.issues }));

  const { type, fileName, mimeType, contentBase64 } = result.data;

  // Buffer.from(b64) silently ignores invalid characters rather than throwing — explicitly reject
  // strings that aren't valid base64 to surface client mistakes.
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(contentBase64)) {
    return next(new HttpError(422, 'invalid_base64'));
  }
  const buffer = Buffer.from(contentBase64, 'base64');
  if (buffer.length === 0) return next(new HttpError(422, 'empty_file'));
  if (buffer.length > MAX_DOC_BYTES) return next(new HttpError(413, 'file_too_large'));

  // never trust the client-supplied mimeType: verify the actual bytes match
  const sniffed = sniffDocMime(buffer);
  if (sniffed === null || sniffed !== mimeType) {
    return next(new HttpError(422, 'unsupported_file_type'));
  }

  try {
    const riderId = req.user!.sub;
    const dir = path.join(UPLOAD_ROOT, riderId);
    await fs.mkdir(dir, { recursive: true });

    const cleanedName = path.basename(fileName).replace(/[^\w.-]+/g, '_');
    // a name that sanitizes to nothing useful is rejected outright
    if (cleanedName === '' || /^_+$/.test(cleanedName)) {
      return next(new HttpError(422, 'invalid_file_name'));
    }
    const storedName = `${crypto.randomUUID()}-${cleanedName}`;
    await fs.writeFile(path.join(dir, storedName), buffer);

    // upsert against the unique (riderId, type) constraint — atomic supersede under any isolation
    const url = `/uploads/rider-documents/${riderId}/${storedName}`;
    const previous = await prisma.riderDocument.findUnique({ where: { riderId_type: { riderId, type } }, select: { url: true } });
    const doc = await prisma.riderDocument.upsert({
      where: { riderId_type: { riderId, type } },
      update: { fileName: cleanedName, mimeType, sizeBytes: buffer.length, url, status: 'pending', uploadedAt: new Date() },
      create: { riderId, type, fileName: cleanedName, mimeType, sizeBytes: buffer.length, url },
    });
    // best-effort: clean up the prior file from disk so PII does not accumulate
    if (previous && previous.url !== url) {
      const prevName = path.basename(previous.url);
      fs.unlink(path.join(UPLOAD_ROOT, riderId, prevName)).catch(() => {});
    }
    res.status(201).json({ document: doc });
  } catch (err) {
    next(err);
  }
});

// GET /api/rider/documents
riderRouter.get('/documents', async (req, res, next) => {
  try {
    const documents = await prisma.riderDocument.findMany({
      where: { riderId: req.user!.sub },
      orderBy: { uploadedAt: 'desc' },
    });
    res.json({ documents });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Orders — available pool, accept / decline, active delivery
// ---------------------------------------------------------------------------

// GET /api/rider/orders/available — unclaimed orders this rider has not declined
riderRouter.get('/orders/available', async (req, res, next) => {
  try {
    const riderId = req.user!.sub;
    const rider = await getRiderOr401(riderId);
    if (!rider.riderOnline) return res.json({ orders: [] }); // offline riders see nothing

    const declined = await prisma.orderDecline.findMany({
      where: { riderId },
      select: { orderId: true },
    });
    const declinedIds = declined.map((d) => d.orderId);

    const orders = await prisma.order.findMany({
      where: {
        status: 'pending_assignment',
        riderId: null,
        ...(declinedIds.length > 0 ? { id: { notIn: declinedIds } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    res.json({ orders });
  } catch (err) {
    next(err);
  }
});

// GET /api/rider/orders/active — the rider's current in-progress delivery (if any)
riderRouter.get('/orders/active', async (req, res, next) => {
  try {
    const order = await prisma.order.findFirst({
      where: {
        riderId: req.user!.sub,
        status: { in: ['rider_assigned', 'at_warehouse', 'picked_up', 'in_transit'] },
      },
      include: { events: { orderBy: { createdAt: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ order: order ?? null });
  } catch (err) {
    next(err);
  }
});

const ACTIVE_ORDER_STATUSES = ['rider_assigned', 'at_warehouse', 'picked_up', 'in_transit'] as const;

// POST /api/rider/orders/:id/accept
riderRouter.post('/orders/:id/accept', async (req, res, next) => {
  try {
    const riderId = req.user!.sub;
    const orderId = String(req.params['id']);

    const rider = await getRiderOr401(riderId);
    assertApproved(rider);
    if (!rider.riderOnline) return next(new HttpError(409, 'rider_offline'));

    // both the busy check and the claim must run in the same serializable transaction;
    // a partial unique index on Order(riderId) WHERE status IN active_set is a defense-in-depth.
    const order = await prisma.$transaction(
      async (tx) => {
        const busy = await tx.order.findFirst({
          where: { riderId, status: { in: [...ACTIVE_ORDER_STATUSES] } },
          select: { id: true },
        });
        if (busy) throw new HttpError(409, 'already_on_delivery');

        const claimed = await tx.order.updateMany({
          where: { id: orderId, status: 'pending_assignment', riderId: null },
          data: { riderId, status: 'rider_assigned', assignmentExpiresAt: null },
        });
        if (claimed.count === 0) throw new HttpError(409, 'order_unavailable');
        await tx.orderEvent.create({ data: { orderId, status: 'rider_assigned', note: 'rider accepted' } });
        return tx.order.findUnique({
          where: { id: orderId },
          include: { events: { orderBy: { createdAt: 'asc' } } },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (!order) return next(new HttpError(409, 'order_unavailable'));

    // La transition vers rider_assigned se fait ICI (claim), pas via PATCH /orders/:id/status :
    // il faut donc diffuser order-status a la room de la commande pour que le suivi client se
    // mette a jour en direct (D-15). Best-effort : getIO() leve tant que le socket n'est pas init.
    try {
      getIO().to(orderRoom(order.id)).emit(ORDER_STATUS, { orderId: order.id, status: order.status });
    } catch {
      // couche socket non initialisee (tests HTTP) — le temps reel est best-effort
    }

    // customer-facing lifecycle email (NOTIF-01) — the order enters status='rider_assigned' HERE
    // (the accept claim above), not via PATCH /orders/:id/status, so this is the correct hook
    // point for that specific transition. Idempotent on (orderId,event,channel); best-effort.
    if (order.customerId) {
      const orderUrl = `${FRONTEND_ORIGIN}/orders/${order.id}`;
      const { subject, html, text } = riderAssignedEmail({ orderReference: order.reference, orderUrl });
      await dispatch({
        userId: order.customerId,
        type: 'rider_assigned',
        event: 'rider_assigned',
        orderId: order.id,
        title: 'Livreur assigné',
        body: `Un livreur a été assigné à votre commande ${order.reference}.`,
        email: { subject, html, text },
        essential: true,
        socketPush: true,
      }).catch(() => {});
    }
    res.json({ order });
  } catch (err) {
    // P2034: serializable conflict (SSI aborts one of two concurrent transactions);
    // P2002: partial unique index violation (the database-level fallback). Both map to 409.
    if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === 'P2002' || err.code === 'P2034')) {
      return next(new HttpError(409, 'already_on_delivery'));
    }
    next(err);
  }
});

// POST /api/rider/orders/:id/decline — hide this order from the rider's available list
riderRouter.post('/orders/:id/decline', async (req, res, next) => {
  try {
    const riderId = req.user!.sub;
    const orderId = String(req.params['id']);

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return next(new HttpError(404, 'order_not_found'));
    if (order.status !== 'pending_assignment' || order.riderId !== null) {
      return next(new HttpError(409, 'order_not_offered'));
    }

    await prisma.orderDecline.upsert({
      where: { orderId_riderId: { orderId, riderId } },
      create: { orderId, riderId },
      update: {},
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Returns — scheduled return pickups the rider collects from customers
// ---------------------------------------------------------------------------

const RETURN_SELECT = {
  id: true, reference: true, status: true, orderId: true, customerId: true, riderId: true,
  pickupAddress: true, pickupLat: true, pickupLng: true, scheduledFor: true, riderFee: true,
  completedAt: true, createdAt: true,
} as const;

function serializeReturn<T extends { riderFee: Prisma.Decimal }>(r: T) {
  return { ...r, riderFee: Number(r.riderFee) };
}

// GET /api/rider/returns — available (unclaimed, scheduled) returns + the ones assigned to this rider
riderRouter.get('/returns', async (req, res, next) => {
  try {
    const riderId = req.user!.sub;
    const rider = await getRiderOr401(riderId);
    const [available, mine] = await Promise.all([
      rider.riderApplicationStatus === 'approved' && rider.riderOnline
        ? prisma.return.findMany({ where: { status: 'scheduled', riderId: null }, orderBy: { createdAt: 'asc' }, select: RETURN_SELECT, take: 50 })
        : Promise.resolve([]),
      prisma.return.findMany({ where: { riderId, status: { in: ['accepted', 'completed'] } }, orderBy: { updatedAt: 'desc' }, select: RETURN_SELECT, take: 50 }),
    ]);
    res.json({ available: available.map(serializeReturn), mine: mine.map(serializeReturn) });
  } catch (err) {
    next(err);
  }
});

// POST /api/rider/returns/:id/accept — atomically claim a scheduled return
riderRouter.post('/returns/:id/accept', async (req, res, next) => {
  try {
    const riderId = req.user!.sub;
    const returnId = String(req.params['id']);
    const rider = await getRiderOr401(riderId);
    assertApproved(rider);

    const ret = await prisma.$transaction(async (tx) => {
      const claimed = await tx.return.updateMany({
        where: { id: returnId, status: 'scheduled', riderId: null },
        data: { riderId, status: 'accepted' },
      });
      if (claimed.count === 0) return null;
      return tx.return.findUnique({ where: { id: returnId }, select: RETURN_SELECT });
    });
    if (!ret) return next(new HttpError(409, 'return_unavailable'));
    res.json({ return: serializeReturn(ret) });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/rider/returns/:id/complete — mark a return collected from the customer
riderRouter.patch('/returns/:id/complete', async (req, res, next) => {
  try {
    const riderId = req.user!.sub;
    const returnId = String(req.params['id']);

    // a rider whose application was revoked mid-flight cannot keep crediting themselves
    const rider = await getRiderOr401(riderId);
    assertApproved(rider);

    const ret = await prisma.$transaction(async (tx) => {
      const current = await tx.return.findUnique({ where: { id: returnId } });
      if (!current) throw new HttpError(404, 'return_not_found');
      if (current.riderId !== riderId) throw new HttpError(403, 'not_your_return');
      if (current.status !== 'accepted') throw new HttpError(409, 'invalid_return_status', { status: current.status });
      return tx.return.update({ where: { id: returnId }, data: { status: 'completed', completedAt: new Date() }, select: RETURN_SELECT });
    });
    // awaited so the notification is durable at response time, but errors are swallowed —
    // a notification-system blip should not roll back a committed completion
    await notify(riderId, 'earning_credited', 'Retour complété', `Retour ${ret.reference} : ${Number(ret.riderFee).toFixed(2)} € crédités`).catch(() => {});
    res.json({ return: serializeReturn(ret) });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

// GET /api/rider/notifications — newest first; pass ?unread=true to filter
riderRouter.get('/notifications', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const onlyUnread = req.query['unread'] === 'true';
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId, ...(onlyUnread ? { read: false } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.notification.count({ where: { userId, read: false } }),
    ]);
    res.json({ notifications, unreadCount });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/rider/notifications/:id/read — mark a single notification read
riderRouter.patch('/notifications/:id/read', async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const updated = await prisma.notification.updateMany({
      where: { id: String(req.params['id']), userId },
      data: { read: true },
    });
    if (updated.count === 0) return next(new HttpError(404, 'notification_not_found'));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// POST /api/rider/notifications/read-all — mark every unread notification read
riderRouter.post('/notifications/read-all', async (req, res, next) => {
  try {
    const result = await prisma.notification.updateMany({ where: { userId: req.user!.sub, read: false }, data: { read: true } });
    res.json({ updated: result.count });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Earnings — completed deliveries + completed return pickups
// ---------------------------------------------------------------------------

function startOfDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfWeek(d = new Date()): Date {
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - dow);
  return x;
}
function startOfMonth(d = new Date()): Date {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

async function sumEarningsSince(riderId: string, since: Date) {
  const [orderAgg, returnAgg] = await Promise.all([
    prisma.order.aggregate({ where: { riderId, status: 'delivered', deliveredAt: { gte: since } }, _sum: { riderFee: true }, _count: true }),
    prisma.return.aggregate({ where: { riderId, status: 'completed', completedAt: { gte: since } }, _sum: { riderFee: true }, _count: true }),
  ]);
  return {
    total: Number(orderAgg._sum.riderFee ?? new Prisma.Decimal(0)) + Number(returnAgg._sum.riderFee ?? new Prisma.Decimal(0)),
    deliveries: orderAgg._count,
    returns: returnAgg._count,
  };
}

// GET /api/rider/earnings — today / week / month / all-time summary
riderRouter.get('/earnings', async (req, res, next) => {
  try {
    const riderId = req.user!.sub;
    const [today, week, month, allTime] = await Promise.all([
      sumEarningsSince(riderId, startOfDay()),
      sumEarningsSince(riderId, startOfWeek()),
      sumEarningsSince(riderId, startOfMonth()),
      sumEarningsSince(riderId, new Date(0)),
    ]);
    res.json({ today, week, month, allTime });
  } catch (err) {
    next(err);
  }
});

// GET /api/rider/earnings/history — per-job breakdown (deliveries + returns), newest first
riderRouter.get('/earnings/history', async (req, res, next) => {
  try {
    const riderId = req.user!.sub;
    const [orders, returns] = await Promise.all([
      prisma.order.findMany({
        where: { riderId, status: 'delivered' },
        orderBy: { deliveredAt: 'desc' },
        select: { id: true, reference: true, pickupAddress: true, dropoffAddress: true, riderFee: true, deliveredAt: true },
        take: 100,
      }),
      prisma.return.findMany({
        where: { riderId, status: 'completed' },
        orderBy: { completedAt: 'desc' },
        select: { id: true, reference: true, pickupAddress: true, riderFee: true, completedAt: true },
        take: 100,
      }),
    ]);
    const history = [
      ...orders.map((o) => ({ kind: 'delivery' as const, id: o.id, reference: o.reference, pickupAddress: o.pickupAddress, dropoffAddress: o.dropoffAddress, riderFee: Number(o.riderFee), completedAt: o.deliveredAt })),
      ...returns.map((r) => ({ kind: 'return' as const, id: r.id, reference: r.reference, pickupAddress: r.pickupAddress, dropoffAddress: null as string | null, riderFee: Number(r.riderFee), completedAt: r.completedAt })),
    ].sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0));
    res.json({ history });
  } catch (err) {
    next(err);
  }
});
