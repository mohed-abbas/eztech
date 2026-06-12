import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { CreateCommerceOrderSchema, CreateDeliveryJobSchema, UpdateOrderStatusSchema } from '../schemas/order.js';
import { generateOrderReference, canRiderTransition } from '../lib/orders.js';
import { notify, notifyOnlineRiders } from '../lib/notifications.js';
import { computeLineTotal, computeOrderTotals } from '../lib/pricing.js';
import { pointInAnyZone } from '../lib/zones.js';
import { getStripe } from '../lib/stripe.js';

export const ordersRouter = Router();

// POST /api/orders — create an order (customer or admin). Two shapes share this entry point:
//  • commerce (body carries items[]): server-priced, zone-gated, awaiting_payment, OUT of the
//    rider pool until the Stripe webhook flips it to paid (D-04/D-06/D-07/D-10/D-11/D-14).
//  • legacy delivery-job (no items[]): seeds a pending_assignment order straight into the rider
//    pool, preserving the existing rider lifecycle create path.
ordersRouter.post('/', requireAuth, requireRole('customer', 'admin'), async (req, res, next) => {
  // legacy delivery-job create — selected when the client sends no cart lines
  if (!req.body || (req.body as { items?: unknown }).items === undefined) {
    return createDeliveryJob(req, res, next);
  }

  const result = CreateCommerceOrderSchema.safeParse(req.body);
  if (!result.success) return next(new HttpError(422, 'validation_failed', { issues: result.error.issues }));

  try {
    const { customerId, items, dropoff } = result.data;

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

    // authoritative zone gate — reject a dropoff outside every active zone before any write (D-14)
    if (!(await pointInAnyZone(dropoff.lng, dropoff.lat))) {
      return next(new HttpError(422, 'outside_delivery_zone'));
    }

    // load the live products in one query; reject if any requested product is missing/inactive
    const productIds = items.map((i) => i.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds }, isActive: true } });
    const productById = new Map(products.map((p) => [p.id, p]));
    for (const item of items) {
      if (!productById.has(item.productId)) return next(new HttpError(404, 'product_not_found', { productId: item.productId }));
    }

    // recompute every line from the live product price — client-sent money is ignored (D-06)
    const lineSnapshots = items.map((item) => {
      const product = productById.get(item.productId)!;
      const { unitPrice, lineTotal } = computeLineTotal(
        {
          pricingType: product.pricingType,
          flatPrice: product.flatPrice,
          hourlyPrice: product.hourlyPrice,
          dailyPrice: product.dailyPrice,
          weeklyPrice: product.weeklyPrice,
        },
        item,
      );
      return {
        productId: product.id,
        name: product.name,
        imageUrl: product.imageUrl,
        quantity: item.quantity,
        durationUnit: item.durationUnit,
        durationValue: item.durationValue,
        unitPrice,
        lineTotal,
      };
    });
    const { subtotal, deliveryFee, total } = computeOrderTotals(lineSnapshots.map((l) => l.lineTotal));

    // pick a single warehouse that stocks EVERY item at the requested quantity (D-11). The
    // intersection of "warehouses with enough stock" across all items is the eligible set.
    const stocks = await prisma.warehouseStock.findMany({ where: { productId: { in: productIds } } });
    let eligible: Set<string> | null = null;
    for (const item of items) {
      const enough = new Set(
        stocks.filter((s) => s.productId === item.productId && s.quantity >= item.quantity).map((s) => s.warehouseId),
      );
      eligible = eligible === null ? enough : new Set([...eligible].filter((id: string) => enough.has(id)));
      if (eligible.size === 0) break;
    }
    if (!eligible || eligible.size === 0) {
      // no warehouse can fulfil the whole cart at create-time (insufficient stock or a split cart)
      return next(new HttpError(409, 'no_single_warehouse'));
    }
    const warehouseId = [...eligible][0]!;
    const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) return next(new HttpError(409, 'no_single_warehouse'));

    const order = await prisma.order.create({
      data: {
        reference: generateOrderReference(),
        customerId: effectiveCustomerId,
        // unpaid commerce order is held OUT of the rider pool — the webhook flips BOTH
        // paymentStatus→paid and status→pending_assignment once the signed event arrives (D-04)
        status: 'awaiting_payment',
        paymentStatus: 'awaiting_payment',
        warehouseId: warehouse.id,
        subtotal,
        deliveryFee,
        total,
        // pickup is the selected fulfillment warehouse; dropoff is the validated request address
        pickupAddress: warehouse.address,
        pickupLat: warehouse.lat,
        pickupLng: warehouse.lng,
        dropoffAddress: dropoff.address,
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
        items: { create: lineSnapshots },
      },
      include: { items: true },
    });
    // NOTE: the order is NOT rider-visible yet — no pending_assignment OrderEvent and no rider
    // notification here. Those fire from the Stripe webhook once paymentStatus flips to paid (D-04).
    res.status(201).json({ order });
  } catch (err) {
    next(err);
  }
});

// legacy delivery-job create — drops a pending_assignment order straight into the rider pool
// and notifies online riders. Customer anchoring matches the commerce path (anti-spoof).
async function createDeliveryJob(req: Request, res: Response, next: NextFunction): Promise<void> {
  const result = CreateDeliveryJobSchema.safeParse(req.body);
  if (!result.success) {
    next(new HttpError(422, 'validation_failed', { issues: result.error.issues }));
    return;
  }

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

    let effectiveCustomerId: string | null = null;
    if (req.user!.role === 'admin') {
      if (customerId !== undefined) {
        const target = await prisma.user.findUnique({ where: { id: customerId }, select: { id: true, role: true } });
        if (!target || target.role !== 'customer') return next(new HttpError(422, 'invalid_customer'));
        effectiveCustomerId = target.id;
      }
    }
    else {
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
    await notifyOnlineRiders('new_order', 'Nouvelle commande disponible', `Commande ${order.reference} à proximité`).catch(() => {});
    res.status(201).json({ order });
  } catch (err) {
    next(err);
  }
}

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

// POST /api/orders/:id/cancel — the owning customer (pre-pickup) or an admin cancels an order.
// A full Stripe refund is issued and the decremented stock is restored, but ONLY when the order
// was actually paid (stock is decremented at paid time, so an unpaid order has nothing to restore
// and no charge to refund). The order ends paymentStatus=refunded + status=cancelled (D-12).
ordersRouter.post('/:id/cancel', requireAuth, async (req, res, next) => {
  const orderId = String(req.params['id']);

  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) return next(new HttpError(404, 'order_not_found'));

    // owner-or-admin only (mirrors the GET ownership check) — no IDOR on cancel
    const { sub, role } = req.user!;
    const allowed = role === 'admin' || order.customerId === sub;
    if (!allowed) return next(new HttpError(403, 'forbidden'));

    // once a rider has the parcel the order can no longer be cancelled by the customer
    if (['picked_up', 'in_transit', 'delivered'].includes(order.status)) {
      return next(new HttpError(409, 'not_cancellable', { status: order.status }));
    }
    if (order.paymentStatus === 'refunded' || order.status === 'cancelled') {
      return next(new HttpError(409, 'already_cancelled'));
    }

    const wasPaid = order.paymentStatus === 'paid';

    // refund the captured charge only when there is one (paid orders carry a payment intent)
    if (wasPaid && order.stripePaymentIntentId) {
      const stripe = await getStripe();
      // deterministic idempotency key keyed on the order — replays/double-submits are no-ops (CR-02)
      await stripe.refunds.create(
        { payment_intent: order.stripePaymentIntentId },
        { idempotencyKey: `refund_${order.id}` },
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      // restore stock only if it was actually decremented (i.e. the order had reached paid)
      if (wasPaid && order.warehouseId) {
        for (const item of order.items) {
          if (!item.productId) continue;
          await tx.warehouseStock.updateMany({
            where: { warehouseId: order.warehouseId, productId: item.productId },
            data: { quantity: { increment: item.quantity } },
          });
        }
      }
      const result = await tx.order.update({
        where: { id: orderId },
        data: { paymentStatus: 'refunded', status: 'cancelled' },
        include: { items: true },
      });
      await tx.orderEvent.create({ data: { orderId, status: 'cancelled', note: 'refunded' } });
      return result;
    });

    res.json({ order: updated });
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
      // awaited so the notification is durable by the time we respond, but errors are swallowed
      await notify(riderId, 'earning_credited', 'Livraison complétée', `Commande ${order.reference} : ${Number(order.riderFee).toFixed(2)} € crédités`).catch(() => {});
    }
    res.json({ order });
  } catch (err) {
    next(err);
  }
});
