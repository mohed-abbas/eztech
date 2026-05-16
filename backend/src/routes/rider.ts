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
import { notify } from '../lib/notifications.js';

export const riderRouter = Router();

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
  if (!user || user.role !== 'rider') throw new HttpError(401, 'user_not_found');
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

// POST /api/rider/documents — upload license / insurance proof (base64 body)
riderRouter.post('/documents', async (req, res, next) => {
  const result = UploadRiderDocumentSchema.safeParse(req.body);
  if (!result.success) return next(new HttpError(422, 'validation_failed', { issues: result.error.issues }));

  const { type, fileName, mimeType, contentBase64 } = result.data;

  let buffer: Buffer;
  try {
    buffer = Buffer.from(contentBase64, 'base64');
  } catch {
    return next(new HttpError(422, 'invalid_base64'));
  }
  if (buffer.length === 0) return next(new HttpError(422, 'empty_file'));
  if (buffer.length > MAX_DOC_BYTES) return next(new HttpError(413, 'file_too_large'));

  try {
    const riderId = req.user!.sub;
    const dir = path.join(UPLOAD_ROOT, riderId);
    await fs.mkdir(dir, { recursive: true });

    const safeName = path.basename(fileName).replace(/[^\w.-]+/g, '_');
    const storedName = `${crypto.randomUUID()}-${safeName}`;
    await fs.writeFile(path.join(dir, storedName), buffer);

    const doc = await prisma.riderDocument.create({
      data: {
        riderId,
        type,
        fileName: safeName,
        mimeType,
        sizeBytes: buffer.length,
        url: `/uploads/rider-documents/${riderId}/${storedName}`,
      },
    });
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
    res.json({ order });
  } catch (err) {
    // partial unique index collision (defense-in-depth) — map to 409
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
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
        ? prisma.return.findMany({ where: { status: 'scheduled', riderId: null }, orderBy: { createdAt: 'asc' }, select: RETURN_SELECT })
        : Promise.resolve([]),
      prisma.return.findMany({ where: { riderId, status: { in: ['accepted', 'completed'] } }, orderBy: { updatedAt: 'desc' }, select: RETURN_SELECT }),
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

    const ret = await prisma.$transaction(async (tx) => {
      const current = await tx.return.findUnique({ where: { id: returnId } });
      if (!current) throw new HttpError(404, 'return_not_found');
      if (current.riderId !== riderId) throw new HttpError(403, 'not_your_return');
      if (current.status !== 'accepted') throw new HttpError(409, 'invalid_return_status', { status: current.status });
      return tx.return.update({ where: { id: returnId }, data: { status: 'completed', completedAt: new Date() }, select: RETURN_SELECT });
    });
    await notify(riderId, 'earning_credited', 'Retour complété', `Retour ${ret.reference} : ${Number(ret.riderFee).toFixed(2)} € crédités`);
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
    const res2 = await prisma.notification.updateMany({ where: { userId: req.user!.sub, read: false }, data: { read: true } });
    res.json({ updated: res2.count });
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
      }),
      prisma.return.findMany({
        where: { riderId, status: 'completed' },
        orderBy: { completedAt: 'desc' },
        select: { id: true, reference: true, pickupAddress: true, riderFee: true, completedAt: true },
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
