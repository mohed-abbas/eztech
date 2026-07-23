// node-cron job (Module 9) — auto-charges a late fee on overdue rentals. Loads via the normal
// import graph — never import this from instrument.ts (Sentry-only preload).
//
// An order is chargeable when: it was paid, delivered, its rentalEndsAt has passed, the item has
// NOT been returned, a card was saved off_session at checkout, and no late fee was charged yet.
// The charge is idempotent three ways: cron noOverlap, the lateFeeChargedAt DB guard, and the
// per-order Stripe idempotency key — so no overlapping tick or restart can double-charge.
import cron, { type ScheduledTask } from 'node-cron';
import { prisma } from '../lib/prisma.js';
import { getStripe } from '../lib/stripe.js';
import { computeLateFee, toCents } from '../lib/late-fee.js';
import { dispatch } from '../lib/notifications.js';
import { lateFeePendingEmail, lateFeeChargedEmail } from '../lib/email/templates.js';
import { logger } from '../lib/logger.js';

const FRONTEND_ORIGIN = (process.env['CORS_ORIGIN'] ?? 'http://localhost:3000').split(',')[0]!.trim();

let task: ScheduledTask | null = null;

export async function runLateFeesOnce(): Promise<void> {
  const now = new Date();

  // overdue, delivered, paid, card saved, not yet charged, and NOT already returned
  const candidates = await prisma.order.findMany({
    where: {
      paymentStatus: 'paid',
      status: 'delivered',
      rentalEndsAt: { lt: now },
      lateFeeChargedAt: null,
      stripePaymentMethodId: { not: null },
      customerId: { not: null },
      returns: { none: { status: 'completed' } },
    },
    include: { items: true, customer: { select: { id: true, stripeCustomerId: true } } },
  });

  for (const order of candidates) {
    const fee = computeLateFee(order.items, order.rentalEndsAt, now);
    if (fee.lte(0)) continue; // all-flat order or not actually overdue — nothing to charge
    if (!order.customer?.stripeCustomerId || !order.stripePaymentMethodId) continue;

    const orderUrl = `${FRONTEND_ORIGIN}/orders/${order.id}`;
    const amount = fee.toNumber();

    // notify BEFORE charging (idempotent on orderId+event via the dispatch unique key — a retry
    // after a failed charge won't re-send). Essential: payment-related, ignores emailOptOut.
    await dispatch({
      userId: order.customerId!,
      type: 'late_fee_pending',
      event: 'late_fee_pending',
      orderId: order.id,
      title: 'Frais de retard',
      body: `Votre location ${order.reference} est en retard. Des frais de ${amount.toFixed(2)} € vont etre preleves.`,
      email: lateFeePendingEmail({ orderReference: order.reference, amount, orderUrl }),
      socketPush: true,
      essential: true,
    });

    try {
      const stripe = await getStripe();
      const intent = await stripe.paymentIntents.create(
        {
          amount: toCents(fee),
          currency: 'eur',
          customer: order.customer.stripeCustomerId,
          payment_method: order.stripePaymentMethodId,
          off_session: true,
          confirm: true,
          metadata: { orderId: order.id, kind: 'late_fee' },
        },
        { idempotencyKey: `latefee_${order.id}` },
      );
      if (intent.status !== 'succeeded') {
        logger.warn({ orderId: order.id, status: intent.status }, 'late-fee charge not succeeded');
        continue;
      }

      // guard the flip on lateFeeChargedAt=null so a concurrent tick can't double-record.
      const updated = await prisma.order.updateMany({
        where: { id: order.id, lateFeeChargedAt: null },
        data: { lateFeeChargedAt: now, lateFeeAmount: fee, lateFeeStripePaymentIntentId: intent.id },
      });
      if (updated.count === 0) continue; // another tick recorded it first — don't re-notify

      await dispatch({
        userId: order.customerId!,
        type: 'late_fee_charged',
        event: 'late_fee_charged',
        orderId: order.id,
        title: 'Frais de retard preleves',
        body: `Des frais de retard de ${amount.toFixed(2)} € ont ete preleves pour la commande ${order.reference}.`,
        email: lateFeeChargedEmail({ orderReference: order.reference, amount, orderUrl }),
        socketPush: true,
        essential: true,
      });
    } catch (e) {
      // off_session charges can fail (authentication_required, card declined) — log and leave the
      // order for a later tick; the pending notification already went out (idempotently).
      logger.error({ e, orderId: order.id }, 'late-fee charge failed');
    }
  }
}

export function startLateFees(): void {
  task = cron.schedule('* * * * *', runLateFeesOnce, { name: 'late-fees', noOverlap: true });
}

export function stopLateFees(): void {
  void task?.stop();
  task = null;
}
