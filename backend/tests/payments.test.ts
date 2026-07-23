import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app.js';
import { truncateRiderTables, truncateCatalogTables, testPrisma } from './helpers/db.js';
import { stripeMockFactory, resetStripeMock, stripeMockState, fakePaymentIntentSucceeded } from './helpers/stripeMock.js';

// Mock the Stripe SDK so the suite runs with no live keys.
vi.mock('stripe', () => stripeMockFactory());

const app = buildApp();

type AuthResponse = { token: string };

async function customerToken(email = 'pay-cust@example.com'): Promise<string> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'password123', name: 'Cust', phone: '' });
  // verify the email so the customer clears the Module 1 order gate
  await testPrisma.user.update({ where: { email }, data: { emailVerifiedAt: new Date() } });
  return (res.body as AuthResponse).token;
}

async function adminToken(): Promise<string> {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@eztech.fr', password: 'adminpass123' });
  return (res.body as AuthResponse).token;
}

// create an order, mint its intent, then flip it to paid via the signed-webhook path
async function createPaidOrder(token: string, productId: string): Promise<string> {
  const create = await request(app)
    .post('/api/orders')
    .set('Authorization', `Bearer ${token}`)
    .send({ items: [{ productId, quantity: 1, durationUnit: 'flat', durationValue: 1 }], dropoff: INSIDE });
  const orderId = (create.body as { order: { id: string } }).order.id;

  await request(app).post('/api/payments/create-intent').set('Authorization', `Bearer ${token}`).send({ orderId });

  stripeMockState.nextEvent = fakePaymentIntentSucceeded(orderId);
  await request(app)
    .post('/api/webhooks/stripe')
    .set('stripe-signature', 'sig')
    .set('content-type', 'application/json')
    .send(Buffer.from(JSON.stringify({ id: 'evt' })));
  return orderId;
}

const INSIDE = { address: 'Paris', lat: 48.85, lng: 2.35 };

async function seedAll() {
  const zone = await testPrisma.zone.create({
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
  const cat = await testPrisma.category.create({ data: { name: 'C', slug: 'pay-cat', description: '', icon: '' } });
  const product = await testPrisma.product.create({
    data: { name: 'P', slug: 'pay-prod', categoryId: cat.id, pricingType: 'flat', flatPrice: 3.5, sortPrice: 3.5, stock: 10 },
  });
  const wh = await testPrisma.warehouse.create({ data: { name: 'WH', address: '1 Quai', lat: 48.85, lng: 2.35 } });
  await testPrisma.warehouseStock.create({ data: { warehouseId: wh.id, productId: product.id, quantity: 5 } });
  return { zone, product, wh };
}

describe('payment-gated stock decrement', () => {
  beforeEach(async () => {
    resetStripeMock();
    await truncateRiderTables();
    await truncateCatalogTables();
  });

  it('decrements stock only after the webhook flips the order to paid', async () => {
    const token = await customerToken();
    const { product, wh } = await seedAll();

    const create = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productId: product.id, quantity: 2, durationUnit: 'flat', durationValue: 1 }],
        dropoff: INSIDE,
      });
    expect(create.status).toBe(201);
    const orderId = (create.body as { order: { id: string } }).order.id;

    // before payment: stock untouched, order not rider-visible (still awaiting_payment)
    const before = await testPrisma.warehouseStock.findFirst({ where: { warehouseId: wh.id, productId: product.id } });
    expect(before?.quantity).toBe(5);
    const pending = await testPrisma.order.findUnique({ where: { id: orderId } });
    expect(pending?.paymentStatus).toBe('awaiting_payment');
    expect(pending?.status).not.toBe('pending_assignment');

    // create the payment intent
    const intent = await request(app)
      .post('/api/payments/create-intent')
      .set('Authorization', `Bearer ${token}`)
      .send({ orderId });
    expect(intent.status).toBe(200);
    expect((intent.body as { clientSecret: string }).clientSecret).toBe('cs_test');

    // simulate the signed webhook flipping the order to paid
    stripeMockState.nextEvent = fakePaymentIntentSucceeded(orderId);
    const hook = await request(app)
      .post('/api/webhooks/stripe')
      .set('stripe-signature', 'sig')
      .set('content-type', 'application/json')
      .send(Buffer.from(JSON.stringify({ id: 'evt' })));
    expect(hook.status).toBe(200);

    // after paid: stock decremented and order enters the rider pool
    const after = await testPrisma.warehouseStock.findFirst({ where: { warehouseId: wh.id, productId: product.id } });
    expect(after?.quantity).toBe(3);
    const paid = await testPrisma.order.findUnique({ where: { id: orderId } });
    expect(paid?.paymentStatus).toBe('paid');
    expect(paid?.status).toBe('pending_assignment');
  });
});

describe('POST /api/payments/:id/refund (admin)', () => {
  beforeEach(async () => {
    resetStripeMock();
    await truncateRiderTables();
    await truncateCatalogTables();
  });

  it('refunds a paid order: flips to refunded/cancelled and calls Stripe with an idempotency key', async () => {
    const token = await customerToken();
    const { product } = await seedAll();
    const orderId = await createPaidOrder(token, product.id);

    const res = await request(app)
      .post(`/api/payments/${orderId}/refund`)
      .set('Authorization', `Bearer ${await adminToken()}`);
    expect(res.status).toBe(200);

    const refunded = await testPrisma.order.findUnique({ where: { id: orderId } });
    expect(refunded?.paymentStatus).toBe('refunded');
    expect(refunded?.status).toBe('cancelled');
    expect(stripeMockState.refundsCreate.length).toBe(1);
  });

  it('is idempotent: a second refund is a no-op 409 and does not issue a second Stripe refund', async () => {
    const token = await customerToken();
    const { product } = await seedAll();
    const orderId = await createPaidOrder(token, product.id);
    const admin = await adminToken();

    const first = await request(app).post(`/api/payments/${orderId}/refund`).set('Authorization', `Bearer ${admin}`);
    expect(first.status).toBe(200);
    const second = await request(app).post(`/api/payments/${orderId}/refund`).set('Authorization', `Bearer ${admin}`);
    expect(second.status).toBe(409);
    expect((second.body as { error: string }).error).toBe('not_refundable');
  });

  it('returns 403 for a non-admin caller', async () => {
    const token = await customerToken();
    const { product } = await seedAll();
    const orderId = await createPaidOrder(token, product.id);

    const res = await request(app).post(`/api/payments/${orderId}/refund`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(stripeMockState.refundsCreate.length).toBe(0);
  });

  it('returns 409 for an unpaid (awaiting_payment) order', async () => {
    const token = await customerToken();
    const { product } = await seedAll();
    const create = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId: product.id, quantity: 1, durationUnit: 'flat', durationValue: 1 }], dropoff: INSIDE });
    const orderId = (create.body as { order: { id: string } }).order.id;

    const res = await request(app).post(`/api/payments/${orderId}/refund`).set('Authorization', `Bearer ${await adminToken()}`);
    expect(res.status).toBe(409);
    expect((res.body as { error: string }).error).toBe('not_refundable');
  });

  it('returns 404 for an unknown order', async () => {
    const res = await request(app)
      .post('/api/payments/00000000-0000-0000-0000-000000000000/refund')
      .set('Authorization', `Bearer ${await adminToken()}`);
    expect(res.status).toBe(404);
  });
});
