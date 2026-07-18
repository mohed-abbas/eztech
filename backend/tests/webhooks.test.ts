import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app.js';
import { truncateRiderTables, truncateCatalogTables, testPrisma } from './helpers/db.js';
import { stripeMockFactory, resetStripeMock, stripeMockState, fakePaymentIntentSucceeded } from './helpers/stripeMock.js';
import { sendEmail } from '../src/lib/resend.js';
import type * as ResendModule from '../src/lib/resend.js';

// Mock the Stripe SDK so the suite runs with no live keys.
vi.mock('stripe', () => stripeMockFactory());
// Spy on sendEmail so low-stock opt-out suppression is observable — the real implementation is
// already inert in tests (RESEND_API_KEY unset), this just lets us assert call args.
vi.mock('../src/lib/resend.js', async (importOriginal) => {
  const actual = await importOriginal<typeof ResendModule>();
  // no await needed — callers always `await` this call, and `await` on a plain value resolves
  // immediately, so a sync return keeps the real function's Promise-returning call shape.
  return { ...actual, sendEmail: vi.fn(() => ({ skipped: true as const })) };
});

const app = buildApp();

type AuthResponse = { token: string };

async function customerToken(email = 'hook-cust@example.com'): Promise<string> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'password123', name: 'Cust', phone: '' });
  return (res.body as AuthResponse).token;
}

const INSIDE = { address: 'Paris', lat: 48.85, lng: 2.35 };

async function seedOrder(token: string) {
  await testPrisma.zone.create({
    data: {
      name: 'Paris',
      isActive: true,
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [2.0, 48.5],
            [2.7, 48.5],
            [2.7, 49.0],
            [2.0, 49.0],
            [2.0, 48.5],
          ],
        ],
      },
    },
  });
  const cat = await testPrisma.category.create({ data: { name: 'C', slug: 'hook-cat', description: '', icon: '' } });
  const product = await testPrisma.product.create({
    data: { name: 'P', slug: 'hook-prod', categoryId: cat.id, pricingType: 'flat', flatPrice: 3.5, sortPrice: 3.5, stock: 10 },
  });
  const wh = await testPrisma.warehouse.create({ data: { name: 'WH', address: '1 Quai', lat: 48.85, lng: 2.35 } });
  await testPrisma.warehouseStock.create({ data: { warehouseId: wh.id, productId: product.id, quantity: 5 } });

  const create = await request(app)
    .post('/api/orders')
    .set('Authorization', `Bearer ${token}`)
    .send({ items: [{ productId: product.id, quantity: 2, durationUnit: 'flat', durationValue: 1 }], dropoff: INSIDE });
  return { orderId: (create.body as { order: { id: string } }).order.id, warehouseId: wh.id, productId: product.id };
}

function postHook() {
  return request(app)
    .post('/api/webhooks/stripe')
    .set('stripe-signature', 'sig')
    .set('content-type', 'application/json')
    .send(Buffer.from(JSON.stringify({ id: 'evt' })));
}

describe('stripe webhook', () => {
  beforeEach(async () => {
    resetStripeMock();
    vi.mocked(sendEmail).mockClear();
    await truncateRiderTables();
    await truncateCatalogTables();
    // truncateRiderTables intentionally preserves role='admin' rows (the seed admin) — these
    // test-created extra admins are NOT part of the seed, so they must be cleaned up explicitly
    // or they'd survive (and unique-collide) across every subsequent run.
    await testPrisma.user.deleteMany({ where: { email: { in: ['admin-b@eztech.fr', 'admin-c@eztech.fr'] } } });
  });

  it('rejects a bad signature with 400 and changes no order state', async () => {
    const token = await customerToken();
    const { orderId } = await seedOrder(token);

    stripeMockState.constructEventThrows = true; // simulate invalid signature
    const res = await postHook();
    expect(res.status).toBe(400);

    const order = await testPrisma.order.findUnique({ where: { id: orderId } });
    expect(order?.paymentStatus).toBe('awaiting_payment');
    expect(order?.status).not.toBe('pending_assignment');
  });

  it('flips to paid idempotently — replaying the event is a no-op', async () => {
    const token = await customerToken();
    const { orderId, warehouseId, productId } = await seedOrder(token);

    stripeMockState.nextEvent = fakePaymentIntentSucceeded(orderId);

    const first = await postHook();
    expect(first.status).toBe(200);
    const afterFirst = await testPrisma.order.findUnique({ where: { id: orderId } });
    expect(afterFirst?.paymentStatus).toBe('paid');
    expect(afterFirst?.status).toBe('pending_assignment');
    const stockAfterFirst = await testPrisma.warehouseStock.findFirst({ where: { warehouseId, productId } });
    expect(stockAfterFirst?.quantity).toBe(3);

    // replay the same event — must be a no-op (no double decrement)
    const second = await postHook();
    expect(second.status).toBe(200);
    const stockAfterSecond = await testPrisma.warehouseStock.findFirst({ where: { warehouseId, productId } });
    expect(stockAfterSecond?.quantity).toBe(3);
  });

  it('dispatches order_confirmed once — a webhook replay never duplicates it (T-06-11)', async () => {
    const token = await customerToken();
    const { orderId } = await seedOrder(token);
    stripeMockState.nextEvent = fakePaymentIntentSucceeded(orderId);

    const first = await postHook();
    expect(first.status).toBe(200);
    const rowsAfterFirst = await testPrisma.notification.findMany({ where: { orderId, event: 'order_confirmed' } });
    expect(rowsAfterFirst).toHaveLength(1);

    const second = await postHook();
    expect(second.status).toBe(200);
    const rowsAfterSecond = await testPrisma.notification.findMany({ where: { orderId, event: 'order_confirmed' } });
    expect(rowsAfterSecond).toHaveLength(1);
  });

  it('low-stock threshold crossing emails non-opted-out admins and persists one row per admin with orderId=null (no P2002 drop)', async () => {
    const token = await customerToken();
    // seedOrder buys quantity=2 against a warehouse stocked with 5 — post-decrement quantity=3,
    // crossing the default LOW_STOCK_THRESHOLD (<=3).
    const { orderId } = await seedOrder(token);

    // a second admin, NOT opted out — must receive both the row and the email
    const adminB = await testPrisma.user.create({
      data: { email: 'admin-b@eztech.fr', name: 'Admin B', passwordHash: 'x', role: 'admin', emailOptOut: false },
    });
    // a third admin, opted out — receives the row but the email must be suppressed (NOTIF-06)
    await testPrisma.user.create({
      data: { email: 'admin-c@eztech.fr', name: 'Admin C', passwordHash: 'x', role: 'admin', emailOptOut: true },
    });

    stripeMockState.nextEvent = fakePaymentIntentSucceeded(orderId);
    const res = await postHook();
    expect(res.status).toBe(200);

    // every admin (seeded admin@eztech.fr + adminB + adminC) gets a persisted row — the
    // orderId=null idempotency key never collides across admins/products (Pitfall 2)
    const rows = await testPrisma.notification.findMany({ where: { event: 'low_stock' } });
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows.every((r) => r.orderId === null)).toBe(true);
    const recipientIds = new Set(rows.map((r) => r.userId));
    expect(recipientIds.has(adminB.id)).toBe(true);

    // email suppressed for the opted-out admin, sent to the non-opted-out ones
    const emailedAddresses = vi.mocked(sendEmail).mock.calls.map((call) => call[0]?.to);
    expect(emailedAddresses).toContain('admin-b@eztech.fr');
    expect(emailedAddresses).not.toContain('admin-c@eztech.fr');
  });
});
