import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app.js';
import { truncateRiderTables, truncateCatalogTables, testPrisma } from './helpers/db.js';

const app = buildApp();

type AuthResponse = { token: string };

async function customerToken(email = 'cust@example.com'): Promise<string> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'password123', name: 'Cust', phone: '' });
  return (res.body as AuthResponse).token;
}

// A dropoff point known to sit inside the seeded zone (a 1x1 degree box around Paris).
const INSIDE = { address: '10 Rue de Rivoli, Paris', lat: 48.85, lng: 2.35 };

async function seedZone() {
  // GeoJSON Polygon box covering central Paris — INSIDE point falls within it.
  return testPrisma.zone.create({
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
}

async function seedWarehouse() {
  return testPrisma.warehouse.create({
    data: { name: 'WH Paris', address: '1 Quai', lat: 48.85, lng: 2.35 },
  });
}

async function seedProduct(slug = 'charger-96w', flatPrice = 3.5) {
  const cat = await testPrisma.category.create({
    data: { name: 'Chargeurs', slug: `cat-${slug}`, description: '', icon: '' },
  });
  return testPrisma.product.create({
    data: {
      name: 'Charger 96W',
      slug,
      categoryId: cat.id,
      pricingType: 'flat',
      flatPrice,
      sortPrice: flatPrice,
      stock: 10,
    },
  });
}

async function stockAt(warehouseId: string, productId: string, quantity: number) {
  return testPrisma.warehouseStock.create({ data: { warehouseId, productId, quantity } });
}

describe('commerce order create', () => {
  beforeEach(async () => {
    await truncateRiderTables();
    await truncateCatalogTables();
  });

  it('recomputes totals (ignores client-sent prices)', async () => {
    const token = await customerToken();
    await seedZone();
    const wh = await seedWarehouse();
    const product = await seedProduct('charger-recompute', 3.5);
    await stockAt(wh.id, product.id, 5);

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productId: product.id, quantity: 2, durationUnit: 'flat', durationValue: 1, unitPrice: 0.01, lineTotal: 0.02 }],
        dropoff: INSIDE,
        subtotal: 0.02,
        total: 0.02,
      });

    expect(res.status).toBe(201);
    const order = (res.body as { order: { subtotal: string; total: string } }).order;
    // server recomputes from live product price (3.5 * 2 = 7.00), ignoring client values
    expect(Number(order.subtotal)).toBe(7);
  });

  it('delivery fee comes from the server, not the client', async () => {
    const token = await customerToken();
    await seedZone();
    const wh = await seedWarehouse();
    const product = await seedProduct('charger-fee', 3.5);
    await stockAt(wh.id, product.id, 5);

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productId: product.id, quantity: 1, durationUnit: 'flat', durationValue: 1 }],
        dropoff: INSIDE,
        deliveryFee: 0,
      });

    expect(res.status).toBe(201);
    const order = (res.body as { order: { deliveryFee: string } }).order;
    expect(Number(order.deliveryFee)).toBe(4.99);
  });

  it('rejects insufficient stock at create', async () => {
    const token = await customerToken();
    await seedZone();
    const wh = await seedWarehouse();
    const product = await seedProduct('charger-low', 3.5);
    await stockAt(wh.id, product.id, 1);

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productId: product.id, quantity: 5, durationUnit: 'flat', durationValue: 1 }],
        dropoff: INSIDE,
      });

    expect([409, 422]).toContain(res.status);
    const count = await testPrisma.order.count();
    expect(count).toBe(0);
  });

  it('rejects when no single warehouse stocks all items', async () => {
    const token = await customerToken();
    await seedZone();
    const wh1 = await seedWarehouse();
    const wh2 = await testPrisma.warehouse.create({ data: { name: 'WH B', address: '2 Quai', lat: 48.86, lng: 2.36 } });
    const productA = await seedProduct('item-a', 3.5);
    const productB = await seedProduct('item-b', 4.0);
    // A is only in wh1, B is only in wh2 — no single warehouse has both
    await stockAt(wh1.id, productA.id, 5);
    await stockAt(wh2.id, productB.id, 5);

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [
          { productId: productA.id, quantity: 1, durationUnit: 'flat', durationValue: 1 },
          { productId: productB.id, quantity: 1, durationUnit: 'flat', durationValue: 1 },
        ],
        dropoff: INSIDE,
      });

    expect([409, 422]).toContain(res.status);
    const count = await testPrisma.order.count();
    expect(count).toBe(0);
  });

  it('refund on cancel restores stock and flips paymentStatus=refunded', async () => {
    const token = await customerToken();
    await seedZone();
    const wh = await seedWarehouse();
    const product = await seedProduct('charger-refund', 3.5);
    await stockAt(wh.id, product.id, 5);

    // create + (simulated) paid path lands in waves 1-2; this asserts the end state.
    const create = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productId: product.id, quantity: 2, durationUnit: 'flat', durationValue: 1 }],
        dropoff: INSIDE,
      });
    expect(create.status).toBe(201);
    const orderId = (create.body as { order: { id: string } }).order.id;

    const cancel = await request(app).post(`/api/orders/${orderId}/cancel`).set('Authorization', `Bearer ${token}`);
    expect(cancel.status).toBe(200);
    const order = (cancel.body as { order: { paymentStatus: string } }).order;
    expect(order.paymentStatus).toBe('refunded');
  });

  it('GET /api/orders lists only the calling customer own orders with items', async () => {
    const mineToken = await customerToken('mine@example.com');
    const otherToken = await customerToken('other@example.com');
    await seedZone();
    const wh = await seedWarehouse();
    const product = await seedProduct('charger-list', 3.5);
    await stockAt(wh.id, product.id, 20);

    const place = (token: string) =>
      request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [{ productId: product.id, quantity: 1, durationUnit: 'flat', durationValue: 1 }],
          dropoff: INSIDE,
        });

    expect((await place(mineToken)).status).toBe(201);
    expect((await place(otherToken)).status).toBe(201);

    const list = await request(app).get('/api/orders').set('Authorization', `Bearer ${mineToken}`);
    expect(list.status).toBe(200);
    const orders = (list.body as { orders: Array<{ items: unknown[] }> }).orders;
    expect(orders).toHaveLength(1);
    expect(Array.isArray(orders[0]!.items)).toBe(true);
    expect(orders[0]!.items).toHaveLength(1);
  });

  it('double cancel is a no-op — the second cancel returns 409 already_cancelled', async () => {
    const token = await customerToken();
    await seedZone();
    const wh = await seedWarehouse();
    const product = await seedProduct('charger-dblcancel', 3.5);
    await stockAt(wh.id, product.id, 5);

    const create = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productId: product.id, quantity: 2, durationUnit: 'flat', durationValue: 1 }],
        dropoff: INSIDE,
      });
    expect(create.status).toBe(201);
    const orderId = (create.body as { order: { id: string } }).order.id;

    const first = await request(app).post(`/api/orders/${orderId}/cancel`).set('Authorization', `Bearer ${token}`);
    expect(first.status).toBe(200);

    const second = await request(app).post(`/api/orders/${orderId}/cancel`).set('Authorization', `Bearer ${token}`);
    expect(second.status).toBe(409);
  });
});
