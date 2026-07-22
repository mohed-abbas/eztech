import { describe, it, expect, beforeEach } from 'vitest';
import { truncateRiderTables, testPrisma } from './helpers/db.js';
import { runAssignmentExpiryOnce } from '../src/jobs/assignment-expiry.js';
import { OFFER_TTL_MS } from '../src/lib/assignment.js';

async function createOrder(reference: string, over: Record<string, unknown> = {}) {
  return testPrisma.order.create({
    data: {
      reference,
      pickupAddress: 'Entrepôt EzTech',
      dropoffAddress: '1 Rue de Test',
      riderFee: 5,
      status: 'pending_assignment',
      ...over,
    },
  });
}

async function createRider(email: string): Promise<string> {
  const rider = await testPrisma.user.create({
    data: { email, name: 'Rider Test', passwordHash: 'x', role: 'rider' },
  });
  return rider.id;
}

describe('assignment-expiry cron — fenêtre d\'offre glissante (assignmentExpiresAt)', () => {
  beforeEach(truncateRiderTables);

  it('pose une échéance sur une commande non prise dont assignmentExpiresAt est null', async () => {
    const order = await createOrder('OFFER-NULL', { assignmentExpiresAt: null });

    const before = Date.now();
    await runAssignmentExpiryOnce();
    const after = await testPrisma.order.findUnique({ where: { id: order.id } });

    expect(after?.assignmentExpiresAt).not.toBeNull();
    const expiry = after!.assignmentExpiresAt!.getTime();
    expect(expiry).toBeGreaterThan(before);
    // ~ now + OFFER_TTL_MS (large tolérance)
    expect(expiry).toBeLessThanOrEqual(Date.now() + OFFER_TTL_MS + 5_000);
  });

  it('ré-arme une fenêtre déjà expirée', async () => {
    const order = await createOrder('OFFER-EXPIRED', {
      assignmentExpiresAt: new Date(Date.now() - 60_000), // expirée il y a 1 min
    });

    await runAssignmentExpiryOnce();
    const after = await testPrisma.order.findUnique({ where: { id: order.id } });

    expect(after!.assignmentExpiresAt!.getTime()).toBeGreaterThan(Date.now());
  });

  it('ne touche pas une commande déjà prise par un livreur', async () => {
    const riderId = await createRider('claimed-rider@example.com');
    const order = await createOrder('OFFER-CLAIMED', {
      status: 'rider_assigned',
      riderId,
      assignmentExpiresAt: null,
    });

    await runAssignmentExpiryOnce();
    const after = await testPrisma.order.findUnique({ where: { id: order.id } });

    expect(after?.assignmentExpiresAt).toBeNull();
  });

  it('ne ré-arme pas une fenêtre encore valide (future)', async () => {
    const future = new Date(Date.now() + 3_600_000); // +1 h
    const order = await createOrder('OFFER-FUTURE', { assignmentExpiresAt: future });

    await runAssignmentExpiryOnce();
    const after = await testPrisma.order.findUnique({ where: { id: order.id } });

    expect(after!.assignmentExpiresAt!.getTime()).toBe(future.getTime());
  });
});
