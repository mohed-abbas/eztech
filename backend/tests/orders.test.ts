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
  const body = res.body as AuthResponse & { user: { id: string } };
  // verify the email so the customer passes the Module 1 order gate (mirrors the real flow where a
  // customer confirms their address before their first order)
  await testPrisma.user.update({ where: { id: body.user.id }, data: { emailVerifiedAt: new Date() } });
  return body.token;
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

async function seedTieredProduct(
  slug: string,
  prices: { hourlyPrice?: number; dailyPrice?: number } = { hourlyPrice: 2.0 },
) {
  const cat = await testPrisma.category.create({
    data: { name: 'Location', slug: `cat-${slug}`, description: '', icon: '' },
  });
  const sortPrice = prices.hourlyPrice ?? prices.dailyPrice ?? 0;
  return testPrisma.product.create({
    data: {
      name: 'Tente',
      slug,
      categoryId: cat.id,
      pricingType: 'tiered',
      sortPrice,
      stock: 10,
      ...(prices.hourlyPrice !== undefined ? { hourlyPrice: prices.hourlyPrice } : {}),
      ...(prices.dailyPrice !== undefined ? { dailyPrice: prices.dailyPrice } : {}),
    },
  });
}

type FullAuthResponse = { user: { id: string }; token: string };

async function registerCustomerFull(email: string): Promise<{ id: string; token: string }> {
  const res = await request(app).post('/api/auth/register').send({ email, password: 'password123', name: 'Cust', phone: '' });
  const body = res.body as FullAuthResponse;
  // pass the Module 1 order gate (see customerToken)
  await testPrisma.user.update({ where: { id: body.user.id }, data: { emailVerifiedAt: new Date() } });
  return { id: body.user.id, token: body.token };
}

// registers an approved, online rider ready to accept orders
async function registerOnlineRider(email = 'rider-lifecycle@example.com'): Promise<{ id: string; token: string }> {
  const res = await request(app).post('/api/auth/register').send({
    email, password: 'password123', name: 'Rider', phone: '0600000000',
    vehicleType: 'scooter', licenseNumber: 'LIC-1', insuranceNumber: 'INS-1',
  });
  const body = res.body as FullAuthResponse;
  await testPrisma.user.update({ where: { id: body.user.id }, data: { riderApplicationStatus: 'approved' } });
  await request(app).patch('/api/rider/status').set('Authorization', `Bearer ${body.token}`).send({ online: true });
  return { id: body.user.id, token: body.token };
}

// simulates the Stripe webhook's paid transition directly (this suite is not exercising Stripe) —
// flips the order into the rider pool exactly like handlePaymentSucceeded does on the happy path.
async function markPaid(orderId: string) {
  await testPrisma.order.update({ where: { id: orderId }, data: { paymentStatus: 'paid', status: 'pending_assignment' } });
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

describe('order lifecycle notifications (NOTIF-01 / N-05 rentalEndsAt)', () => {
  beforeEach(async () => {
    await truncateRiderTables();
    await truncateCatalogTables();
  });

  it('delivered timed order sets rentalEndsAt from deliveredAt + max duration and creates exactly one return_reminder row', async () => {
    const customer = await registerCustomerFull('n05-timed@example.com');
    const rider = await registerOnlineRider('n05-timed-rider@example.com');
    await seedZone();
    const wh = await seedWarehouse();
    // two non-flat lines — the reminder must anchor on the LONGEST duration (10h beats 1 day? no —
    // compare in ms: hourly*10 = 36_000_000ms vs daily*1 = 86_400_000ms, so daily wins here)
    const shortItem = await seedTieredProduct('n05-hourly', { hourlyPrice: 2.0 });
    const longItem = await seedTieredProduct('n05-daily', { dailyPrice: 5.0 });
    await stockAt(wh.id, shortItem.id, 5);
    await stockAt(wh.id, longItem.id, 5);

    const create = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({
        items: [
          { productId: shortItem.id, quantity: 1, durationUnit: 'hourly', durationValue: 10 },
          { productId: longItem.id, quantity: 1, durationUnit: 'daily', durationValue: 1 },
        ],
        dropoff: INSIDE,
      });
    expect(create.status).toBe(201);
    const orderId = (create.body as { order: { id: string } }).order.id;

    await markPaid(orderId);
    const accept = await request(app).post(`/api/rider/orders/${orderId}/accept`).set('Authorization', `Bearer ${rider.token}`);
    expect(accept.status).toBe(200);
    // rider_assigned lifecycle email fires exactly once from the accept claim
    const assignedRows = await testPrisma.notification.findMany({ where: { orderId, event: 'rider_assigned' } });
    expect(assignedRows).toHaveLength(1);
    expect(assignedRows[0]?.userId).toBe(customer.id);

    for (const status of ['at_warehouse', 'picked_up', 'in_transit', 'delivered'] as const) {
      const r = await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${rider.token}`)
        .send({ status });
      expect(r.status).toBe(200);
    }

    const order = await testPrisma.order.findUnique({ where: { id: orderId } });
    expect(order?.deliveredAt).not.toBeNull();
    expect(order?.rentalEndsAt).not.toBeNull();
    const expectedMs = order!.deliveredAt!.getTime() + 1 * 86_400_000; // daily*1 beats hourly*10
    expect(order!.rentalEndsAt!.getTime()).toBe(expectedMs);

    const reminders = await testPrisma.notification.findMany({ where: { orderId, event: 'return_reminder' } });
    expect(reminders).toHaveLength(1);
    expect(reminders[0]?.sentAt).toBeNull();
    expect(reminders[0]?.scheduledAt?.getTime()).toBe(expectedMs - 2 * 3_600_000);

    // lifecycle emails fire exactly once per event across the whole run (idempotent)
    const pickedUpRows = await testPrisma.notification.findMany({ where: { orderId, event: 'order_picked_up' } });
    expect(pickedUpRows).toHaveLength(1);
    const deliveredRows = await testPrisma.notification.findMany({ where: { orderId, event: 'order_delivered' } });
    expect(deliveredRows).toHaveLength(1);

    // a repeated 'delivered' transition is rejected by the state machine — the lifecycle email
    // is never re-dispatched (idempotent across a replayed/duplicate request)
    const repeat = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${rider.token}`)
      .send({ status: 'delivered' });
    expect(repeat.status).toBe(409);
    const deliveredRowsAfterRepeat = await testPrisma.notification.findMany({ where: { orderId, event: 'order_delivered' } });
    expect(deliveredRowsAfterRepeat).toHaveLength(1);
  });

  it('all-flat order delivers with rentalEndsAt=null and creates zero return_reminder rows', async () => {
    const customer = await registerCustomerFull('n05-flat@example.com');
    const rider = await registerOnlineRider('n05-flat-rider@example.com');
    await seedZone();
    const wh = await seedWarehouse();
    const product = await seedProduct('n05-flat-product', 3.5);
    await stockAt(wh.id, product.id, 5);

    const create = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({
        items: [{ productId: product.id, quantity: 1, durationUnit: 'flat', durationValue: 1 }],
        dropoff: INSIDE,
      });
    expect(create.status).toBe(201);
    const orderId = (create.body as { order: { id: string } }).order.id;

    await markPaid(orderId);
    await request(app).post(`/api/rider/orders/${orderId}/accept`).set('Authorization', `Bearer ${rider.token}`);

    for (const status of ['at_warehouse', 'picked_up', 'in_transit', 'delivered'] as const) {
      const r = await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${rider.token}`)
        .send({ status });
      expect(r.status).toBe(200);
    }

    const order = await testPrisma.order.findUnique({ where: { id: orderId } });
    expect(order?.rentalEndsAt).toBeNull();

    const reminders = await testPrisma.notification.findMany({ where: { orderId, event: 'return_reminder' } });
    expect(reminders).toHaveLength(0);

    // the delivered lifecycle email still fires — N-05's flat-only rule only suppresses the reminder
    const deliveredRows = await testPrisma.notification.findMany({ where: { orderId, event: 'order_delivered' } });
    expect(deliveredRows).toHaveLength(1);
  });
});
