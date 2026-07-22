// node-cron job (assignmentExpiresAt) — ré-arme la fenêtre d'offre des commandes non prises.
// Une commande en pending_assignment sans livreur dont le compte à rebours a expiré (ou n'a
// jamais été posé) reste dans le pool mais voit son assignmentExpiresAt réinitialisé — le
// compte à rebours côté livreur reste ainsi toujours vivant (fenêtre d'offre glissante).
import cron, { type ScheduledTask } from 'node-cron';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { nextAssignmentExpiry } from '../lib/assignment.js';

let task: ScheduledTask | null = null;

export async function runAssignmentExpiryOnce(): Promise<void> {
  const now = new Date();
  const res = await prisma.order.updateMany({
    where: {
      status: 'pending_assignment',
      riderId: null,
      OR: [{ assignmentExpiresAt: null }, { assignmentExpiresAt: { lte: now } }],
    },
    data: { assignmentExpiresAt: nextAssignmentExpiry(now) },
  });
  if (res.count > 0) logger.info({ count: res.count }, 'assignment offers re-armed');
}

export function startAssignmentExpiry(): void {
  task = cron.schedule('* * * * *', runAssignmentExpiryOnce, { name: 'assignment-expiry', noOverlap: true });
}

export function stopAssignmentExpiry(): void {
  void task?.stop();
  task = null;
}
