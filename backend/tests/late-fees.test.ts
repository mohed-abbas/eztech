import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';

// Mock Stripe so off_session charges never hit the network.
import { stripeMockFactory, resetStripeMock, stripeMockState } from './helpers/stripeMock.js';
vi.mock('stripe', () => stripeMockFactory());

const { runLateFeesOnce } = await import('../src/jobs/late-fees.js');
const { truncateRiderTables, testPrisma } = await import('./helpers/db.js');

const TWO_DAYS = 2 * 86_400_000;
// 1.5 days overdue → ceil(1.5) = 2 daily periods, safe from the few-ms drift between the test's
// clock and the job's `now` (an exact N-day boundary would round up into period N+1).
const OVERDUE_MS = 36 * 3_600_000;

async function seedCustomer(email = `lf-${randomUUID()}@example.com`) {
  return testPrisma.user.create({
    data: { email, name: 'LF Cust', phone: '', passwordHash: 'x', stripeCustomerId: 'cus_test' },
  });
}

interface OverdueOpts {
  rentalEndsAt?: Date;
  paymentStatus?: 'paid' | 'awaiting_payment';
  status?: 'delivered' | 'in_transit';
  stripePaymentMethodId?: string | null;
  completedReturn?: boolean;
}

// a delivered, paid, overdue daily rental (3 days @ 10.00, 1 unit) with a saved card
async function seedOverdueOrder(customerId: string, opts: OverdueOpts = {}): Promise<string> {
  const order = await testPrisma.order.create({
    data: {
      reference: `EZ-${randomUUID().slice(0, 8)}`,
      customerId,
      status: opts.status ?? 'delivered',
      paymentStatus: opts.paymentStatus ?? 'paid',
      pickupAddress: 'WH',
      dropoffAddress: '1 rue de Paris',
      rentalEndsAt: opts.rentalEndsAt ?? new Date(Date.now() - OVERDUE_MS),
      deliveredAt: new Date(Date.now() - 5 * 86_400_000),
      stripePaymentMethodId: opts.stripePaymentMethodId === undefined ? 'pm_test' : opts.stripePaymentMethodId,
      total: 30,
      items: {
        create: [{ name: 'Device', quantity: 1, durationUnit: 'daily', durationValue: 3, unitPrice: 10, lineTotal: 30 }],
      },
    },
  });
  if (opts.completedReturn) {
    await testPrisma.return.create({
      data: { reference: `RET-${randomUUID().slice(0, 8)}`, status: 'completed', orderId: order.id, customerId, pickupAddress: '1 rue de Paris' },
    });
  }
  return order.id;
}

const lateFeeCharges = () =>
  stripeMockState.paymentIntentsCreate.filter(
    (p) => (p as { metadata?: { kind?: string } }).metadata?.kind === 'late_fee',
  );

describe('late-fee cron (runLateFeesOnce)', () => {
  beforeEach(async () => {
    resetStripeMock();
    await truncateRiderTables();
  });

  it('charges an overdue rental off_session, records the fee, and notifies before + after', async () => {
    const cust = await seedCustomer();
    const orderId = await seedOverdueOrder(cust.id);

    await runLateFeesOnce();

    const order = await testPrisma.order.findUnique({ where: { id: orderId } });
    expect(order?.lateFeeChargedAt).not.toBeNull();
    expect(Number(order?.lateFeeAmount)).toBe(20); // 2 overdue days × 10.00 × 1
    expect(order?.lateFeeStripePaymentIntentId).toBe('pi_test');

    // the Stripe call was a real off_session charge against the saved card + customer
    const charge = lateFeeCharges()[0] as { off_session?: boolean; payment_method?: string; customer?: string; amount?: number };
    expect(charge?.off_session).toBe(true);
    expect(charge?.payment_method).toBe('pm_test');
    expect(charge?.customer).toBe('cus_test');
    expect(charge?.amount).toBe(2000); // cents

    const types = (await testPrisma.notification.findMany({ where: { userId: cust.id } })).map((n) => n.type);
    expect(types).toContain('late_fee_pending');
    expect(types).toContain('late_fee_charged');
  });

  it('is idempotent — a second run does not charge again', async () => {
    const cust = await seedCustomer();
    await seedOverdueOrder(cust.id);

    await runLateFeesOnce();
    await runLateFeesOnce();

    expect(lateFeeCharges()).toHaveLength(1);
  });

  it('does not charge an order that is not yet overdue', async () => {
    const cust = await seedCustomer();
    const orderId = await seedOverdueOrder(cust.id, { rentalEndsAt: new Date(Date.now() + TWO_DAYS) });

    await runLateFeesOnce();

    const order = await testPrisma.order.findUnique({ where: { id: orderId } });
    expect(order?.lateFeeChargedAt).toBeNull();
    expect(lateFeeCharges()).toHaveLength(0);
  });

  it('does not charge an order whose item was already returned', async () => {
    const cust = await seedCustomer();
    const orderId = await seedOverdueOrder(cust.id, { completedReturn: true });

    await runLateFeesOnce();

    const order = await testPrisma.order.findUnique({ where: { id: orderId } });
    expect(order?.lateFeeChargedAt).toBeNull();
    expect(lateFeeCharges()).toHaveLength(0);
  });

  it('does not charge when no card was saved', async () => {
    const cust = await seedCustomer();
    const orderId = await seedOverdueOrder(cust.id, { stripePaymentMethodId: null });

    await runLateFeesOnce();

    const order = await testPrisma.order.findUnique({ where: { id: orderId } });
    expect(order?.lateFeeChargedAt).toBeNull();
    expect(lateFeeCharges()).toHaveLength(0);
  });

  it('leaves the order uncharged (for retry) when the off_session charge is declined', async () => {
    const cust = await seedCustomer();
    const orderId = await seedOverdueOrder(cust.id);
    stripeMockState.paymentIntentsCreateThrows = true;

    await runLateFeesOnce();

    const order = await testPrisma.order.findUnique({ where: { id: orderId } });
    expect(order?.lateFeeChargedAt).toBeNull(); // not charged — will retry next tick
    const types = (await testPrisma.notification.findMany({ where: { userId: cust.id } })).map((n) => n.type);
    expect(types).toContain('late_fee_pending'); // warned before the attempt
    expect(types).not.toContain('late_fee_charged'); // but never confirmed
  });
});
