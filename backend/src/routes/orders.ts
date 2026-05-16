import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { CreateOrderSchema, UpdateOrderStatusSchema } from '../schemas/order.js';
import { generateOrderReference, canRiderTransition } from '../lib/orders.js';
import { notify, notifyOnlineRiders } from '../lib/notifications.js';

export const ordersRouter = Router();

// POST /api/orders — create a delivery job (customer or admin); lands in the rider available pool
ordersRouter.post('/', requireAuth, requireRole('customer', 'admin'), async (req, res, next) => {
  const result = CreateOrderSchema.safeParse(req.body);
  if (!result.success) return next(new HttpError(422, 'validation_failed', { issues: result.error.issues }));

  try {
    const { customerId, riderFee, ...rest } = result.data;
    const data = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)) as {
      pickupAddress: string;
      dropoffAddress: string;
      pickupLat?: number;
      pickupLng?: number;
      dropoffLat?: number;
      dropoffLng?: number;
    };

    // resolve and validate the effective customerId — admins may target any customer, but the
    // target must exist with role=customer; customers may only create orders for themselves.
    let effectiveCustomerId: string | null = null;
    if (req.user!.role === 'admin') {
      if (customerId !== undefined) {
        const target = await prisma.user.findUnique({ where: { id: customerId }, select: { id: true, role: true } });
        if (!target || target.role !== 'customer') return next(new HttpError(422, 'invalid_customer'));
        effectiveCustomerId = target.id;
      }
    }
    else {
      // customers may not spoof another customerId — always anchor to the authenticated user
      effectiveCustomerId = req.user!.sub;
    }

    const order = await prisma.order.create({
      data: {
        ...data,
        reference: generateOrderReference(),
        customerId: effectiveCustomerId,
        ...(riderFee !== undefined ? { riderFee: new Prisma.Decimal(riderFee) } : {}),
        events: { create: { status: 'pending_assignment', note: 'order created' } },
      },
      include: { events: true },
    });
    // best-effort fan-out — a transient notification failure should not roll back the commit
    notifyOnlineRiders('new_order', 'Nouvelle commande disponible', `Commande ${order.reference} à proximité`).catch(() => {});
    res.status(201).json({ order });
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/:id — visible to the owning customer, the assigned rider, or an admin
ordersRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: String(req.params['id']) },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    });
    if (!order) return next(new HttpError(404, 'order_not_found'));

    const { sub, role } = req.user!;
    const allowed = role === 'admin' || order.customerId === sub || order.riderId === sub;
    if (!allowed) return next(new HttpError(403, 'forbidden'));

    res.json({ order });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/orders/:id/status — the assigned rider advances the delivery lifecycle
// murx's realtime layer listens for the resulting OrderEvent and pushes it to the customer
ordersRouter.patch('/:id/status', requireAuth, requireRole('rider'), async (req, res, next) => {
  const result = UpdateOrderStatusSchema.safeParse(req.body);
  if (!result.success) return next(new HttpError(422, 'validation_failed', { issues: result.error.issues }));

  const { status: nextStatus, note } = result.data;
  const orderId = String(req.params['id']);
  const riderId = req.user!.sub;

  try {
    // revoked riders cannot continue advancing in-flight jobs (matches accept gating)
    const rider = await prisma.user.findUnique({ where: { id: riderId }, select: { role: true, riderApplicationStatus: true } });
    if (!rider || rider.role !== 'rider') return next(new HttpError(401, 'user_revoked'));
    if (rider.riderApplicationStatus !== 'approved') {
      return next(new HttpError(403, 'application_not_approved', { applicationStatus: rider.riderApplicationStatus }));
    }

    const order = await prisma.$transaction(async (tx) => {
      const current = await tx.order.findUnique({ where: { id: orderId } });
      if (!current) throw new HttpError(404, 'order_not_found');
      if (current.riderId !== riderId) throw new HttpError(403, 'not_your_delivery');
      if (!canRiderTransition(current.status, nextStatus)) {
        throw new HttpError(409, 'invalid_transition', { from: current.status, to: nextStatus });
      }
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: nextStatus,
          ...(nextStatus === 'delivered' ? { deliveredAt: new Date() } : {}),
        },
      });
      await tx.orderEvent.create({
        data: { orderId, status: nextStatus, ...(note !== undefined ? { note } : {}) },
      });
      return updated;
    });
    if (order.status === 'delivered') {
      // best-effort: a delivered order should remain delivered even if the notification fails
      notify(riderId, 'earning_credited', 'Livraison complétée', `Commande ${order.reference} : ${Number(order.riderFee).toFixed(2)} € crédités`).catch(() => {});
    }
    res.json({ order });
  } catch (err) {
    next(err);
  }
});
