import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app.js';
import { truncateRiderTables, truncateCatalogTables, testPrisma } from './helpers/db.js';
import { stripeMockFactory, resetStripeMock, stripeMockState, fakePaymentIntentSucceeded } from './helpers/stripeMock.js';

// Mock the Stripe SDK so the suite runs with no live keys.
vi.mock('stripe', () => stripeMockFactory());

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
    await truncateRiderTables();
    await truncateCatalogTables();
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
});
