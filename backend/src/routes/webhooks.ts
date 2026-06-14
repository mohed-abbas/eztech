import { Router } from 'express';
import type Stripe from 'stripe';
import { prisma } from '../lib/prisma.js';
import { getStripe } from '../lib/stripe.js';
import { env } from '../config/env.js';
import { notifyOnlineRiders } from '../lib/notifications.js';

export const webhooksRouter = Router();

// POST /api/webhooks/stripe — the SOLE authority for flipping an order to paid.
//
// Mounted with express.raw (see app.ts) so constructEvent sees the exact signed bytes; the
// signature is the only thing that authenticates this internet-facing, auth-less endpoint
// (D-09). The handler is idempotent (Stripe delivers at-least-once): it only acts while the
// order is still awaiting_payment, so replays are 200 no-ops with no double stock decrement.
webhooksRouter.post('/', async (req, res, next) => {
  const sig = req.headers['stripe-signature'];

  let event: Stripe.Event;
  try {
    const stripe = await getStripe();
    // req.body is a Buffer here (express.raw) — required for signature verification (Pitfall 1)
    event = stripe.webhooks.constructEvent(req.body, sig as string, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    // a forged/invalid signature changes NO state; 400 so Stripe surfaces the failure (D-09)
    return res.status(400).send('invalid signature');
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        await handlePaymentSucceeded(event);
        break;
      }
      case 'payment_intent.payment_failed': {
        const orderId = orderIdOf(event);
        if (orderId) {
          await prisma.order.updateMany({
            where: { id: orderId, paymentStatus: 'awaiting_payment' },
            data: { paymentStatus: 'failed' },
          });
        }
        break;
      }
      case 'charge.refunded': {
        // metadata.orderId lives on the PaymentIntent, NOT the Charge, so a dashboard-initiated
        // refund arrives with no charge metadata — resolve via the charge's payment_intent (WR-04)
        const where = refundedOrderWhere(event);
        if (where) {
          // idempotent: only flip an order that is not already refunded
          await prisma.order.updateMany({
            where: { ...where, paymentStatus: { not: 'refunded' } },
            data: { paymentStatus: 'refunded', status: 'cancelled' },
          });
        }
        break;
      }
      default:
        // unhandled event types are acknowledged so Stripe stops retrying
        break;
    }
    res.json({ received: true });
  } catch (err) {
    next(err);
  }
});

// reads metadata.orderId off the event's payment_intent / charge object
function orderIdOf(event: Stripe.Event): string | undefined {
  const obj = event.data.object as { metadata?: { orderId?: string } };
  return obj.metadata?.orderId;
}

// resolves the order targeted by a charge.refunded event. Prefers metadata.orderId (set on the
// PaymentIntent) but falls back to the charge's payment_intent id matched against
// stripePaymentIntentId, so dashboard/dispute refunds — whose Charge carries no orderId metadata —
// still reconcile the order to refunded (WR-04). Returns a Prisma where-clause or null.
function refundedOrderWhere(
  event: Stripe.Event,
): { id: string } | { stripePaymentIntentId: string } | null {
  const orderId = orderIdOf(event);
  if (orderId) return { id: orderId };
  const charge = event.data.object as { payment_intent?: string | { id: string } | null };
  const pi = charge.payment_intent;
  const piId = typeof pi === 'string' ? pi : pi?.id;
  if (piId) return { stripePaymentIntentId: piId };
  return null;
}

// payment_intent.succeeded → atomically decrement stock and release the order into the rider
// pool. Idempotent (acts only while awaiting_payment); auto-refunds + cancels on a stock
// conflict so a paid-but-unfulfillable order can never exist (Pitfall 2 / A6).
async function handlePaymentSucceeded(event: Stripe.Event): Promise<void> {
  const orderId = orderIdOf(event);
  if (!orderId) return;

  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return;
  // idempotency guard: a replayed event finds the order already paid → no-op (Pitfall 4)
  if (order.paymentStatus !== 'awaiting_payment') return;
  if (!order.warehouseId) return;
  const warehouseId = order.warehouseId;

  let stockConflict = false;
  try {
    await prisma.$transaction(async (tx) => {
      // re-read the gate inside the tx so two concurrent webhooks can't both decrement (TOCTOU)
      const current = await tx.order.findUnique({ where: { id: orderId } });
      if (!current || current.paymentStatus !== 'awaiting_payment') return;

      for (const item of order.items) {
        if (!item.productId) continue;
        // conditional decrement: only succeeds while quantity >= requested; count!==1 ⇒ oversold
        const r = await tx.warehouseStock.updateMany({
          where: { warehouseId, productId: item.productId, quantity: { gte: item.quantity } },
          data: { quantity: { decrement: item.quantity } },
        });
        if (r.count !== 1) {
          stockConflict = true;
          throw new Error('stock_conflict'); // unwinds the decrements done so far in this tx
        }
      }

      await tx.order.update({
        where: { id: orderId },
        data: { paymentStatus: 'paid', status: 'pending_assignment' },
      });
      await tx.orderEvent.create({
        data: { orderId, status: 'pending_assignment', note: 'payment confirmed' },
      });
    });
  } catch (err) {
    if (!stockConflict) throw err; // a real error — surface it; Stripe will retry
  }

  if (stockConflict) {
    // paid but unfulfillable → refund and cancel; never leave a paid-but-unstocked order (A6)
    const stripe = await getStripe();
    if (order.stripePaymentIntentId) {
      // deterministic idempotency key keyed on the order — a webhook replay won't double-refund (CR-02)
      await stripe.refunds.create(
        { payment_intent: order.stripePaymentIntentId },
        { idempotencyKey: `refund_${order.id}` },
      );
    }
    await prisma.order.updateMany({
      where: { id: orderId, paymentStatus: 'awaiting_payment' },
      data: { paymentStatus: 'refunded', status: 'cancelled' },
    });
    return;
  }

  // order is now paid and in the rider pool — fan a notification out to online riders
  await notifyOnlineRiders('new_order', 'Nouvelle commande disponible', `Commande ${order.reference} à proximité`).catch(() => {});
}
