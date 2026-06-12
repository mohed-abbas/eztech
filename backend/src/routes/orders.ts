import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { CreateOrderSchema, UpdateOrderStatusSchema } from '../schemas/order.js';
import { generateOrderReference, canRiderTransition } from '../lib/orders.js';
import { notify } from '../lib/notifications.js';
import { computeLineTotal, computeOrderTotals } from '../lib/pricing.js';
import { pointInAnyZone } from '../lib/zones.js';

export const ordersRouter = Router();

// POST /api/orders — commerce order create (customer or admin). The order is created
// awaiting_payment and stays OUT of the rider pool until the Stripe webhook flips it to paid
// (the paid flip + pending_assignment OrderEvent + rider notification live in the payments plan).
// Server is the sole source of money + zone truth here (D-04/D-06/D-07/D-10/D-11/D-14).
ordersRouter.post('/', requireAuth, requireRole('customer', 'admin'), async (req, res, next) => {
  const result = CreateOrderSchema.safeParse(req.body);
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
      // awaited so the notification is durable by the time we respond, but errors are swallowed
      await notify(riderId, 'earning_credited', 'Livraison complétée', `Commande ${order.reference} : ${Number(order.riderFee).toFixed(2)} € crédités`).catch(() => {});
    }
    res.json({ order });
  } catch (err) {
    next(err);
  }
});
