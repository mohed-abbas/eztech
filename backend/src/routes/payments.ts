import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { getStripe } from '../lib/stripe.js';
import { CreateIntentSchema } from '../schemas/payment.js';

export const paymentsRouter = Router();

// POST /api/payments/create-intent — mint a Stripe PaymentIntent anchored to an order.
// Owner-or-admin only (IDOR guard). The clientSecret returned drives the browser Elements
// confirm; the order is NOT flipped to paid here — that is the signed webhook's job (D-09).
paymentsRouter.post('/create-intent', requireAuth, async (req, res, next) => {
  const result = CreateIntentSchema.safeParse(req.body);
  if (!result.success) return next(new HttpError(422, 'validation_failed', { issues: result.error.issues }));

  try {
    const { orderId } = result.data;
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return next(new HttpError(404, 'order_not_found'));

    // owner-or-admin only (mirrors orders.ts ownership check) — never pay someone else's order
    const { sub, role } = req.user!;
    if (role !== 'admin' && order.customerId !== sub) return next(new HttpError(403, 'forbidden'));

    // only an unpaid order can be charged — already-paid/refunded/failed orders are not payable
    if (order.paymentStatus !== 'awaiting_payment') return next(new HttpError(409, 'not_payable'));

    // idempotencyKey keyed on the order id — a double-submit reuses the same intent (no double charge, D-08)
    const stripe = await getStripe();
    const intent = await stripe.paymentIntents.create(
      {
        // Decimal → integer cents via exact Decimal arithmetic (no IEEE-754 float error, WR-05)
        amount: new Prisma.Decimal(order.total ?? 0).mul(100).toNearest(1).toNumber(),
        currency: 'eur',
        metadata: { orderId: order.id },
        automatic_payment_methods: { enabled: true },
      },
      { idempotencyKey: `intent_${order.id}` },
    );

    await prisma.order.update({ where: { id: order.id }, data: { stripePaymentIntentId: intent.id } });

    res.json({ clientSecret: intent.client_secret });
  } catch (err) {
    next(err);
  }
});

// POST /api/payments/:id/refund — admin-only full refund (D5). Exposes as an admin action the same
// Stripe refund the webhook already performs on an unfulfillable order. Idempotent: the Stripe call
// is keyed on the order id (a retry never double-refunds), and the DB flip is guarded on the current
// 'paid' state so a second call is a no-op returning 409.
paymentsRouter.post('/:id/refund', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const id = String(req.params['id']);
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return next(new HttpError(404, 'order_not_found'));

    // only a paid order can be refunded — awaiting/failed/already-refunded are not refundable
    if (order.paymentStatus !== 'paid') return next(new HttpError(409, 'not_refundable'));
    if (!order.stripePaymentIntentId) return next(new HttpError(409, 'no_payment_intent'));

    // deterministic idempotency key keyed on the order — mirrors the webhook path (CR-02), so an
    // admin double-click or a retry reuses the same Stripe refund rather than issuing a second one.
    const stripe = await getStripe();
    await stripe.refunds.create(
      { payment_intent: order.stripePaymentIntentId },
      { idempotencyKey: `refund_${order.id}` },
    );

    // guard the flip on the paid state: a concurrent second request updates 0 rows and 409s below.
    const updated = await prisma.order.updateMany({
      where: { id, paymentStatus: 'paid' },
      data: { paymentStatus: 'refunded', status: 'cancelled' },
    });
    if (updated.count === 0) return next(new HttpError(409, 'not_refundable'));

    await prisma.orderEvent.create({
      data: { orderId: id, status: 'cancelled', note: 'refunded by admin' },
    });

    const result = await prisma.order.findUnique({ where: { id }, include: { items: true } });
    res.json({ order: result });
  } catch (err) {
    next(err);
  }
});
