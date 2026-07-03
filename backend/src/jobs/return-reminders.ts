// node-cron claim-and-send job (NOTIF-03). Loads via the normal import graph — never import this
// from instrument.ts, which is preloaded via `node --import` and must stay Sentry-only.
import cron, { type ScheduledTask } from 'node-cron';
import { prisma } from '../lib/prisma.js';
import { sendEmail } from '../lib/resend.js';
import { returnReminderEmail } from '../lib/email/templates.js';
import { logger } from '../lib/logger.js';

// base frontend origin for the CTA link — mirrors the FRONTEND_ORIGIN idiom already used in
// routes/orders.ts / routes/rider.ts / routes/webhooks.ts (no dedicated FRONTEND_URL env exists).
const FRONTEND_ORIGIN = (process.env['CORS_ORIGIN'] ?? 'http://localhost:3000').split(',')[0]!.trim();

let task: ScheduledTask | null = null;

interface ClaimedReminder {
  id: string;
  userId: string;
  orderId: string | null;
}

// Claims due return_reminder rows and sends the reminder email. The claim (select + sentAt=now)
// happens in ONE $transaction, BEFORE any email is sent — this is the authoritative guard against
// double-fire on an overlapping tick or a process restart mid-send (T-06-15, Pitfall 4).
export async function runReturnRemindersOnce(): Promise<void> {
  const now = new Date();

  const claimed: ClaimedReminder[] = await prisma.$transaction(async (tx) => {
    const due = await tx.notification.findMany({
      where: { event: 'return_reminder', sentAt: null, scheduledAt: { lte: now } },
      select: { id: true, userId: true, orderId: true },
    });
    if (due.length === 0) return [];
    await tx.notification.updateMany({
      where: { id: { in: due.map((row) => row.id) } },
      data: { sentAt: now },
    });
    return due;
  });

  if (claimed.length === 0) return;

  // Send AFTER the claim commits. A send failure here is logged, not retried — the row stays
  // claimed (T-06-16, accepted MVP tradeoff documented in the plan's threat model).
  for (const reminder of claimed) {
    try {
      const [user, order] = await Promise.all([
        prisma.user.findUnique({ where: { id: reminder.userId }, select: { email: true } }),
        reminder.orderId
          ? prisma.order.findUnique({
              where: { id: reminder.orderId },
              select: { id: true, reference: true, rentalEndsAt: true },
            })
          : null,
      ]);
      if (!user || !order || !order.rentalEndsAt) continue; // nothing sendable — skip, already claimed

      const email = returnReminderEmail({
        orderReference: order.reference,
        rentalEndsAt: order.rentalEndsAt,
        orderUrl: `${FRONTEND_ORIGIN}/orders/${order.id}`,
      });
      // essential — return reminders always send, ignoring emailOptOut (N-06/Pitfall 7)
      await sendEmail({ to: user.email, ...email });
    } catch (e) {
      logger.error({ e, notificationId: reminder.id }, 'return-reminder send failed after claim');
    }
  }
}

// v4 node-cron API: named task + noOverlap:true (secondary guard over the in-txn sentAt claim
// above) — a slow tick can't run concurrently with the next one. No @types/node-cron needed.
export function startReturnReminders(): void {
  task = cron.schedule('* * * * *', runReturnRemindersOnce, { name: 'return-reminders', noOverlap: true });
}

export function stopReturnReminders(): void {
  task?.stop();
  task = null;
}
