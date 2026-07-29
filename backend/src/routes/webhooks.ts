import { Router } from 'express';
import type Stripe from 'stripe';
import type { OrderStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { getStripe } from '../lib/stripe.js';
import { env } from '../config/env.js';
import { notifyOnlineRiders, dispatch } from '../lib/notifications.js';
import { orderConfirmedEmail, lowStockEmail } from '../lib/email/templates.js';
import { getIO } from '../lib/socket.js';
import { RIDERS_AVAILABLE } from '../socket/rooms.js';
import { ORDER_NEW } from '../socket/events.js';
import { nextAssignmentExpiry } from '../lib/assignment.js';

export const webhooksRouter = Router();

// base frontend origin for CTA links in transactional email — mirrors app.ts's CORS_ORIGIN
// parsing (first entry is the primary frontend origin); no dedicated FRONTEND_URL env exists.
const FRONTEND_ORIGIN = (process.env['CORS_ORIGIN'] ?? 'http://localhost:3000').split(',')[0]!.trim();

// NOTIF-06: fire a low-stock admin alert once a warehouse decrement leaves this many units or
// fewer. Small named constant, overridable via env (RESEARCH §Open Q2).
const LOW_STOCK_THRESHOLD = Number(process.env['LOW_STOCK_THRESHOLD'] ?? 3);

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
    // req.body is a Buffer here (express.raw) — required for signature verification (Pitfall 1).
    // Express types req.body as `any`; the cast documents the invariant express.raw() guarantees
    // for this route instead of passing an `any` straight into the Stripe SDK.
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig as string, env.STRIPE_WEBHOOK_SECRET);
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
        await handleChargeRefunded(event);
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

// Stripe emet le MEME evenement `charge.refunded` pour un remboursement partiel et pour un
// remboursement integral. Seul l'integral doit annuler la commande : sans ce test, 5 EUR rendus en
// geste commercial sur une commande deja livree la reecrivaient en `cancelled`.
// `amount` est le montant capture, `amount_refunded` le cumul rembourse sur cette charge.
function isFullRefund(event: Stripe.Event): boolean {
  const charge = event.data.object as { amount?: number | null; amount_refunded?: number | null };
  const amount = charge.amount ?? 0;
  const refunded = charge.amount_refunded ?? 0;
  // amount <= 0 : charge inexploitable, on ne devine pas — traitee comme non integrale
  return amount > 0 && refunded >= amount;
}

// Statuts pour lesquels la marchandise est encore a l'entrepot. Un remboursement integral y annule
// la commande ET remet le stock. Des `picked_up`, le colis est physiquement chez le livreur ou chez
// le client : on enregistre bien le remboursement, mais on n'incremente PAS le stock, sinon on
// inventerait des unites qui ne sont pas sur l'etagere — et on ne repasse pas la commande en
// `cancelled`, ce qui effacerait une livraison qui a bel et bien eu lieu.
const REFUND_RESTOCKABLE_STATUSES: readonly OrderStatus[] = [
  'awaiting_payment',
  'pending_assignment',
  'rider_assigned',
  'at_warehouse',
];

// charge.refunded → reconcilie la commande avec le remboursement constate chez Stripe (y compris un
// remboursement lance depuis le dashboard, hors de toute action applicative).
//
// Le stock etait ici purement et simplement PERDU : l'ancien handler basculait la commande en
// `refunded`/`cancelled` sans jamais reincrementer WarehouseStock, et la route de cancel — le seul
// autre endroit qui restitue du stock — refuse ensuite d'agir (`already_cancelled` des que
// paymentStatus vaut `refunded`). Les unites ne revenaient qu'a la main, par un ajustement absolu.
async function handleChargeRefunded(event: Stripe.Event): Promise<void> {
  // metadata.orderId lives on the PaymentIntent, NOT the Charge, so a dashboard-initiated
  // refund arrives with no charge metadata — resolve via the charge's payment_intent (WR-04)
  const where = refundedOrderWhere(event);
  if (!where) return;

  // remboursement partiel : la commande reste ce qu'elle est, aucune ecriture
  if (!isFullRefund(event)) return;

  await prisma.$transaction(async (tx) => {
    const current = await tx.order.findFirst({ where });
    if (!current) return;
    // Idempotence (Stripe livre au moins une fois) : une commande deja remboursee ne rejoue rien.
    // C'est aussi ce qui empeche la DOUBLE restitution quand le remboursement vient de notre propre
    // route de cancel : elle a deja pose paymentStatus=refunded et rendu le stock avant d'appeler
    // Stripe, donc le webhook qui s'ensuit ressort ici sans rien toucher.
    if (current.paymentStatus === 'refunded') return;

    const wasPaid = current.paymentStatus === 'paid';
    const restockable = REFUND_RESTOCKABLE_STATUSES.includes(current.status);

    // Claim gardee, meme motif que la route de cancel : deux livraisons concurrentes du meme
    // evenement ne peuvent pas gagner toutes les deux, la perdante obtient count = 0 et sort avant
    // la boucle de restitution.
    const claim = await tx.order.updateMany({
      where: { id: current.id, status: current.status, paymentStatus: current.paymentStatus },
      data: { paymentStatus: 'refunded', ...(restockable ? { status: 'cancelled' as const } : {}) },
    });
    if (claim.count !== 1) return;

    // stock restitue seulement s'il avait ete decremente (le decrement a lieu au passage a `paid`)
    // ET si le colis n'a pas quitte l'entrepot
    if (wasPaid && restockable && current.warehouseId) {
      const items = await tx.orderItem.findMany({
        where: { orderId: current.id },
        select: { productId: true, quantity: true },
      });
      for (const item of items) {
        if (!item.productId) continue;
        await tx.warehouseStock.updateMany({
          where: { warehouseId: current.warehouseId, productId: item.productId },
          data: { quantity: { increment: item.quantity } },
        });
      }
    }

    await tx.orderEvent.create({
      data: {
        orderId: current.id,
        status: restockable ? 'cancelled' : current.status,
        note: 'remboursement Stripe',
      },
    });
  });
}

// payment_intent.succeeded → atomically decrement stock and release the order into the rider
// pool. Idempotent (acts only while awaiting_payment); auto-refunds + cancels on a stock
// conflict so a paid-but-unfulfillable order can never exist (Pitfall 2 / A6).
async function handlePaymentSucceeded(event: Stripe.Event): Promise<void> {
  const orderId = orderIdOf(event);
  if (!orderId) return;

  // capture the saved card (setup_future_usage=off_session at checkout) so an overdue rental can be
  // charged a late fee later without the customer present (Module 9). String id or expanded object.
  const pi = event.data.object as { payment_method?: string | { id?: string } | null };
  const paymentMethodId =
    typeof pi.payment_method === 'string' ? pi.payment_method : pi.payment_method?.id ?? null;

  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return;
  // idempotency guard: a replayed event finds the order already paid → no-op (Pitfall 4)
  if (order.paymentStatus !== 'awaiting_payment') return;
  if (!order.warehouseId) return;
  const warehouseId = order.warehouseId;

  let stockConflict = false;
  // true uniquement si CETTE execution a remporte la claim ci-dessous — les effets de bord
  // post-transaction (email de confirmation, alerte livreurs) ne doivent partir que pour elle.
  let claimed = false;
  // populated inside the txn on a successful decrement that crosses the low-stock threshold;
  // only acted on AFTER the txn commits without conflict (a rolled-back txn discards these too).
  const lowStockItems: { name: string; quantity: number }[] = [];
  try {
    await prisma.$transaction(async (tx) => {
      // Claim gardee AVANT tout decrement — c'est elle, et non une relecture, qui serialise deux
      // livraisons simultanees du meme evenement. Une simple relecture ne suffisait pas : en READ
      // COMMITTED (isolation par defaut, ce $transaction n'en demande aucune autre) deux
      // transactions qui se chevauchent lisaient toutes les deux `awaiting_payment`, puis leurs
      // `updateMany ... WHERE quantity >= n` reevaluaient chacune la nouvelle version de la ligne
      // de stock et reussissaient toutes les deux : le stock partait deux fois. Un UPDATE, lui,
      // pose un verrou sur la ligne Order : la seconde transaction attend le commit de la
      // premiere, reevalue son WHERE sur la version commitee et obtient count = 0.
      // Les rejeux SEQUENTIELS restent couverts par le meme WHERE.
      const claim = await tx.order.updateMany({
        where: { id: orderId, paymentStatus: 'awaiting_payment' },
        data: {
          paymentStatus: 'paid',
          status: 'pending_assignment',
          assignmentExpiresAt: nextAssignmentExpiry(),
          ...(paymentMethodId ? { stripePaymentMethodId: paymentMethodId } : {}),
        },
      });
      if (claim.count !== 1) return; // une autre livraison a gagne : ne rien decrementer
      claimed = true;

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
        // NOTIF-06: authoritative decrement point — check the post-decrement quantity here only.
        const stock = await tx.warehouseStock.findFirst({ where: { warehouseId, productId: item.productId } });
        if (stock && stock.quantity <= LOW_STOCK_THRESHOLD) {
          lowStockItems.push({ name: item.name, quantity: stock.quantity });
        }
      }

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

  // Livraison perdante d'un evenement concurrent (ou rejeu) : la commande a bien ete encaissee,
  // mais par l'autre execution, qui a deja envoye les notifications. Sortir ici evite de les
  // dedoubler.
  if (!claimed) return;

  // customer-facing payment confirmation (NOTIF-01) — essential, idempotent on
  // (orderId,event,channel); a webhook replay never reaches here (paid-guard above).
  if (order.customerId) {
    const orderUrl = `${FRONTEND_ORIGIN}/orders/${order.id}`;
    const { subject, html, text } = orderConfirmedEmail({
      orderReference: order.reference,
      total: Number(order.total ?? 0),
      orderUrl,
    });
    await dispatch({
      userId: order.customerId,
      type: 'order_confirmed',
      event: 'order_confirmed',
      orderId: order.id,
      title: 'Commande confirmée',
      body: `Votre commande ${order.reference} est confirmée.`,
      email: { subject, html, text },
      essential: true,
      socketPush: true,
    }).catch(() => {});
  }

  // rider real-time alert (NOTIF-05) — best-effort emit; getIO() throws before the socket layer
  // is initialised (e.g. HTTP-only tests), mirroring the orders.ts:341 swallow idiom.
  try {
    getIO().to(RIDERS_AVAILABLE).emit(ORDER_NEW, { orderId: order.id, reference: order.reference });
  } catch {
    // socket layer not initialised — realtime is best-effort
  }

  // order is now paid and in the rider pool — fan a notification (DB-persisted) out to online riders
  await notifyOnlineRiders('new_order', 'Nouvelle commande disponible', `Commande ${order.reference} à proximité`).catch(() => {});

  // low-stock alert (NOTIF-06) — non-essential (opt-out gated). Destinataires : tous les admins +
  // le manager de l'entrepot concerne. Fan-out rows persist with orderId=null (Pitfall 2) so N
  // recipients × N low-stock products never collide on the (orderId,event,channel) unique key.
  if (lowStockItems.length > 0) {
    const admins = await prisma.user.findMany({ where: { role: 'admin' }, select: { id: true } });
    const wh = await prisma.warehouse.findUnique({ where: { id: warehouseId }, select: { managerId: true } });
    const recipientIds = new Set<string>(admins.map((a) => a.id));
    if (wh?.managerId) recipientIds.add(wh.managerId);
    const inventoryUrl = `${FRONTEND_ORIGIN}/warehouse/inventory`;
    for (const item of lowStockItems) {
      const { subject, html, text } = lowStockEmail({ productName: item.name, quantity: item.quantity, adminUrl: inventoryUrl });
      for (const userId of recipientIds) {
        await dispatch({
          userId,
          type: 'low_stock',
          event: 'low_stock',
          orderId: null,
          title: 'Alerte stock bas',
          body: `${item.name} : ${item.quantity} unité(s) restante(s).`,
          email: { subject, html, text },
          essential: false,
          socketPush: true,
        }).catch(() => {});
      }
    }
  }
}
