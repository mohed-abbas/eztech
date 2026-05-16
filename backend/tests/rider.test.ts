import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app.js';
import { truncateRiderTables, testPrisma } from './helpers/db.js';

const app = buildApp();

type AuthResponse = { user: { id: string; role: string }; token: string; refreshToken: string };

// registers a rider whose onboarding application is still `pending`
async function registerPendingRider(email = 'rider1@example.com'): Promise<AuthResponse> {
  const res = await request(app).post('/api/auth/register').send({
    email,
    password: 'password123',
    name: 'Rider One',
    phone: '0600000001',
    vehicleType: 'scooter',
    licenseNumber: 'LIC-1',
    insuranceNumber: 'INS-1',
  });
  return res.body as AuthResponse;
}

// registers a rider and approves their application (most flows require an approved rider)
async function registerRider(email = 'rider1@example.com'): Promise<AuthResponse> {
  const auth = await registerPendingRider(email);
  await testPrisma.user.update({ where: { id: auth.user.id }, data: { riderApplicationStatus: 'approved' } });
  return auth;
}

async function registerCustomer(email = 'cust1@example.com'): Promise<AuthResponse> {
  await request(app).post('/api/auth/register').send({
    email, password: 'password123', name: 'Cust One', phone: '0600000002',
  });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  return res.body as AuthResponse;
}

function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}

describe('rider auth & profile', () => {
  beforeEach(truncateRiderTables);

  it('registers a rider with role=rider and the supplied vehicle/licence fields', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'r@example.com', password: 'password123', name: 'R', phone: '0600000003',
      vehicleType: 'bicycle', licenseNumber: 'L1', insuranceNumber: 'I1',
    });
    expect(res.status).toBe(201);
    const body = res.body as AuthResponse & { user: Record<string, unknown> };
    expect(body.user.role).toBe('rider');
    expect(body.user.vehicleType).toBe('bicycle');
    expect(body.user).not.toHaveProperty('passwordHash');
  });

  it('rejects a rider sign-up missing licence/insurance with 422', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'r2@example.com', password: 'password123', name: 'R2', phone: '0600000004',
      vehicleType: 'car',
    });
    expect(res.status).toBe(422);
  });

  it('GET /api/rider/profile returns the rider profile', async () => {
    const { token } = await registerRider();
    const res = await request(app).get('/api/rider/profile').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.profile).toMatchObject({ vehicleType: 'scooter', online: false, totalDeliveries: 0 });
  });

  it('PUT /api/rider/profile updates editable fields', async () => {
    const { token } = await registerRider();
    const res = await request(app).put('/api/rider/profile').set(bearer(token)).send({ phone: '0699999999', vehicleType: 'car' });
    expect(res.status).toBe(200);
    expect(res.body.profile).toMatchObject({ phone: '0699999999', vehicleType: 'car' });
  });

  it('PATCH /api/rider/status toggles online', async () => {
    const { token } = await registerRider();
    const res = await request(app).patch('/api/rider/status').set(bearer(token)).send({ online: true });
    expect(res.status).toBe(200);
    expect(res.body.online).toBe(true);
  });

  it('rejects non-rider tokens with 403', async () => {
    const { token } = await registerCustomer();
    const res = await request(app).get('/api/rider/profile').set(bearer(token));
    expect(res.status).toBe(403);
  });
});

// minimal 1x1 PNG, used to satisfy the upload route's magic-byte check
const TINY_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

describe('rider documents', () => {
  beforeEach(truncateRiderTables);

  it('uploads and lists a document', async () => {
    const { token } = await registerRider();
    const upload = await request(app).post('/api/rider/documents').set(bearer(token)).send({
      type: 'license',
      fileName: 'permis.png',
      mimeType: 'image/png',
      contentBase64: TINY_PNG.toString('base64'),
    });
    expect(upload.status).toBe(201);
    expect(upload.body.document).toMatchObject({ type: 'license', status: 'pending' });

    const list = await request(app).get('/api/rider/documents').set(bearer(token));
    expect(list.status).toBe(200);
    expect(list.body.documents).toHaveLength(1);
  });

  it('rejects an upload whose bytes do not match the claimed mime type', async () => {
    const { token } = await registerRider();
    const res = await request(app).post('/api/rider/documents').set(bearer(token)).send({
      type: 'license',
      fileName: 'permis.png',
      mimeType: 'image/png',
      // valid base64 but the bytes are not a PNG — sniffer should reject it
      contentBase64: Buffer.from('not-a-real-image').toString('base64'),
    });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('unsupported_file_type');
  });

  it('supersedes the previous document of the same type', async () => {
    const { token } = await registerRider();
    await request(app).post('/api/rider/documents').set(bearer(token)).send({
      type: 'license', fileName: 'a.png', mimeType: 'image/png', contentBase64: TINY_PNG.toString('base64'),
    });
    await request(app).post('/api/rider/documents').set(bearer(token)).send({
      type: 'license', fileName: 'b.png', mimeType: 'image/png', contentBase64: TINY_PNG.toString('base64'),
    });
    const list = await request(app).get('/api/rider/documents').set(bearer(token));
    expect(list.body.documents).toHaveLength(1);
    expect(list.body.documents[0].fileName).toBe('b.png');
  });
});

describe('rider order flow', () => {
  beforeEach(truncateRiderTables);

  it('runs the full lifecycle: create → available → accept → status updates → delivered → earnings', async () => {
    const customer = await registerCustomer();
    const rider = await registerRider();

    // customer creates an order
    const created = await request(app).post('/api/orders').set(bearer(customer.token)).send({
      pickupAddress: 'Warehouse', dropoffAddress: '1 Rue de Test', riderFee: 7.5,
    });
    expect(created.status).toBe(201);
    const orderId = created.body.order.id as string;

    // offline rider sees nothing
    let avail = await request(app).get('/api/rider/orders/available').set(bearer(rider.token));
    expect(avail.body.orders).toHaveLength(0);

    // go online → order appears
    await request(app).patch('/api/rider/status').set(bearer(rider.token)).send({ online: true });
    avail = await request(app).get('/api/rider/orders/available').set(bearer(rider.token));
    expect(avail.body.orders.map((o: { id: string }) => o.id)).toContain(orderId);

    // accept
    const accept = await request(app).post(`/api/rider/orders/${orderId}/accept`).set(bearer(rider.token));
    expect(accept.status).toBe(200);
    expect(accept.body.order.status).toBe('rider_assigned');

    // accepting again fails (already taken / already on a delivery)
    const acceptAgain = await request(app).post(`/api/rider/orders/${orderId}/accept`).set(bearer(rider.token));
    expect(acceptAgain.status).toBe(409);

    // advance through the lifecycle
    for (const status of ['at_warehouse', 'picked_up', 'in_transit', 'delivered'] as const) {
      const r = await request(app).patch(`/api/orders/${orderId}/status`).set(bearer(rider.token)).send({ status });
      expect(r.status).toBe(200);
      expect(r.body.order.status).toBe(status);
    }

    // skipping a step is rejected
    const customer2 = customer;
    const created2 = await request(app).post('/api/orders').set(bearer(customer2.token)).send({
      pickupAddress: 'W', dropoffAddress: '2 Rue', riderFee: 5,
    });
    const order2Id = created2.body.order.id as string;
    // rider already delivered order1 so is free; accept order2
    await request(app).post(`/api/rider/orders/${order2Id}/accept`).set(bearer(rider.token));
    const bad = await request(app).patch(`/api/orders/${order2Id}/status`).set(bearer(rider.token)).send({ status: 'delivered' });
    expect(bad.status).toBe(409);

    // earnings reflect the one delivered order
    const earnings = await request(app).get('/api/rider/earnings').set(bearer(rider.token));
    expect(earnings.status).toBe(200);
    expect(earnings.body.allTime.deliveries).toBe(1);
    expect(earnings.body.allTime.total).toBeCloseTo(7.5);

    const history = await request(app).get('/api/rider/earnings/history').set(bearer(rider.token));
    expect(history.body.history).toHaveLength(1);
    expect(history.body.history[0].riderFee).toBeCloseTo(7.5);
  });

  it('decline hides an order from that rider', async () => {
    const customer = await registerCustomer();
    const rider = await registerRider();
    await request(app).patch('/api/rider/status').set(bearer(rider.token)).send({ online: true });
    const created = await request(app).post('/api/orders').set(bearer(customer.token)).send({
      pickupAddress: 'W', dropoffAddress: '3 Rue', riderFee: 4,
    });
    const orderId = created.body.order.id as string;

    const decline = await request(app).post(`/api/rider/orders/${orderId}/decline`).set(bearer(rider.token));
    expect(decline.status).toBe(204);

    const avail = await request(app).get('/api/rider/orders/available').set(bearer(rider.token));
    expect(avail.body.orders.map((o: { id: string }) => o.id)).not.toContain(orderId);

    // sanity: the order still exists and is still pending
    const inDb = await testPrisma.order.findUnique({ where: { id: orderId } });
    expect(inDb?.status).toBe('pending_assignment');
  });
});

describe('rider onboarding gate', () => {
  beforeEach(truncateRiderTables);

  it('a pending rider cannot go online', async () => {
    const rider = await registerPendingRider();
    const res = await request(app).patch('/api/rider/status').set(bearer(rider.token)).send({ online: true });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('application_not_approved');
  });

  it('a pending rider cannot accept an order', async () => {
    const customer = await registerCustomer();
    const rider = await registerPendingRider();
    const created = await request(app).post('/api/orders').set(bearer(customer.token)).send({ pickupAddress: 'W', dropoffAddress: 'D', riderFee: 5 });
    const res = await request(app).post(`/api/rider/orders/${created.body.order.id}/accept`).set(bearer(rider.token));
    expect(res.status).toBe(403);
  });

  it('an admin can approve a rider application and the rider can then go online', async () => {
    const admin = await request(app).post('/api/auth/login').send({ email: 'admin@eztech.fr', password: 'adminpass123' });
    const rider = await registerPendingRider();

    const review = await request(app).patch(`/api/users/${rider.user.id}/rider-application`).set(bearer(admin.body.token)).send({ status: 'approved' });
    expect(review.status).toBe(200);
    expect(review.body.user.riderApplicationStatus).toBe('approved');

    const goOnline = await request(app).patch('/api/rider/status').set(bearer(rider.token)).send({ online: true });
    expect(goOnline.status).toBe(200);
    expect(goOnline.body.online).toBe(true);

    // rejecting later forces the rider offline
    const reject = await request(app).patch(`/api/users/${rider.user.id}/rider-application`).set(bearer(admin.body.token)).send({ status: 'rejected' });
    expect(reject.status).toBe(200);
    const profile = await request(app).get('/api/rider/profile').set(bearer(rider.token));
    expect(profile.body.profile).toMatchObject({ applicationStatus: 'rejected', online: false });
  });

  it('rejects rider-application review on a non-rider with 409', async () => {
    const admin = await request(app).post('/api/auth/login').send({ email: 'admin@eztech.fr', password: 'adminpass123' });
    const customer = await registerCustomer();
    const res = await request(app).patch(`/api/users/${customer.user.id}/rider-application`).set(bearer(admin.body.token)).send({ status: 'approved' });
    expect(res.status).toBe(409);
  });
});

describe('rider return pickups', () => {
  beforeEach(truncateRiderTables);

  it('runs the return flow: customer schedules → rider sees it → accept → complete → earnings + notification', async () => {
    const customer = await registerCustomer();
    const rider = await registerRider();
    await request(app).patch('/api/rider/status').set(bearer(rider.token)).send({ online: true });

    const created = await request(app).post('/api/returns').set(bearer(customer.token)).send({ pickupAddress: '5 Rue du Client', riderFee: 4.5 });
    expect(created.status).toBe(201);
    const returnId = created.body.return.id as string;

    let list = await request(app).get('/api/rider/returns').set(bearer(rider.token));
    expect(list.body.available.map((r: { id: string }) => r.id)).toContain(returnId);
    expect(list.body.mine).toHaveLength(0);

    const accept = await request(app).post(`/api/rider/returns/${returnId}/accept`).set(bearer(rider.token));
    expect(accept.status).toBe(200);
    expect(accept.body.return.status).toBe('accepted');

    // a second accept fails — already taken
    const acceptAgain = await request(app).post(`/api/rider/returns/${returnId}/accept`).set(bearer(rider.token));
    expect(acceptAgain.status).toBe(409);

    list = await request(app).get('/api/rider/returns').set(bearer(rider.token));
    expect(list.body.available.map((r: { id: string }) => r.id)).not.toContain(returnId);
    expect(list.body.mine.map((r: { id: string }) => r.id)).toContain(returnId);

    const complete = await request(app).patch(`/api/rider/returns/${returnId}/complete`).set(bearer(rider.token));
    expect(complete.status).toBe(200);
    expect(complete.body.return.status).toBe('completed');

    // completing again is rejected (status is no longer `accepted`)
    const completeAgain = await request(app).patch(`/api/rider/returns/${returnId}/complete`).set(bearer(rider.token));
    expect(completeAgain.status).toBe(409);

    const earnings = await request(app).get('/api/rider/earnings').set(bearer(rider.token));
    expect(earnings.body.allTime.returns).toBe(1);
    expect(earnings.body.allTime.total).toBeCloseTo(4.5);

    const history = await request(app).get('/api/rider/earnings/history').set(bearer(rider.token));
    expect(history.body.history.some((h: { kind: string }) => h.kind === 'return')).toBe(true);

    const notifs = await request(app).get('/api/rider/notifications').set(bearer(rider.token));
    expect(notifs.body.notifications.some((n: { type: string }) => n.type === 'earning_credited')).toBe(true);
  });

  it('a return cannot be completed by another rider', async () => {
    const customer = await registerCustomer();
    const rider1 = await registerRider('r1@example.com');
    const rider2 = await registerRider('r2@example.com');
    await request(app).patch('/api/rider/status').set(bearer(rider1.token)).send({ online: true });

    const created = await request(app).post('/api/returns').set(bearer(customer.token)).send({ pickupAddress: 'X', riderFee: 3 });
    await request(app).post(`/api/rider/returns/${created.body.return.id}/accept`).set(bearer(rider1.token));

    const res = await request(app).patch(`/api/rider/returns/${created.body.return.id}/complete`).set(bearer(rider2.token));
    expect(res.status).toBe(403);
  });
});

describe('rider notifications', () => {
  beforeEach(truncateRiderTables);

  it('a new order notifies online riders, who can mark notifications read', async () => {
    const customer = await registerCustomer();
    const rider = await registerRider();
    await request(app).patch('/api/rider/status').set(bearer(rider.token)).send({ online: true });

    await request(app).post('/api/orders').set(bearer(customer.token)).send({ pickupAddress: 'W', dropoffAddress: 'D', riderFee: 5 });

    let notifs = await request(app).get('/api/rider/notifications').set(bearer(rider.token));
    expect(notifs.body.unreadCount).toBeGreaterThanOrEqual(1);
    const newOrderNotif = notifs.body.notifications.find((n: { type: string }) => n.type === 'new_order') as { id: string };
    expect(newOrderNotif).toBeDefined();

    const read = await request(app).patch(`/api/rider/notifications/${newOrderNotif.id}/read`).set(bearer(rider.token));
    expect(read.status).toBe(204);

    notifs = await request(app).get('/api/rider/notifications?unread=true').set(bearer(rider.token));
    expect(notifs.body.notifications.map((n: { id: string }) => n.id)).not.toContain(newOrderNotif.id);

    // marking a non-existent / someone else's notification → 404
    const bad = await request(app).patch('/api/rider/notifications/00000000-0000-0000-0000-000000000000/read').set(bearer(rider.token));
    expect(bad.status).toBe(404);
  });

  it('an offline rider receives no new-order notification, and read-all clears the counter', async () => {
    const customer = await registerCustomer();
    const rider = await registerRider();
    // rider stays offline
    await request(app).post('/api/orders').set(bearer(customer.token)).send({ pickupAddress: 'W', dropoffAddress: 'D', riderFee: 5 });

    let notifs = await request(app).get('/api/rider/notifications').set(bearer(rider.token));
    expect(notifs.body.notifications.filter((n: { type: string }) => n.type === 'new_order')).toHaveLength(0);

    // create one directly via a delivery completion path: go online, accept, deliver
    await request(app).patch('/api/rider/status').set(bearer(rider.token)).send({ online: true });
    const created = await request(app).post('/api/orders').set(bearer(customer.token)).send({ pickupAddress: 'W2', dropoffAddress: 'D2', riderFee: 6 });
    await request(app).post(`/api/rider/orders/${created.body.order.id}/accept`).set(bearer(rider.token));
    for (const status of ['at_warehouse', 'picked_up', 'in_transit', 'delivered'] as const) {
      await request(app).patch(`/api/orders/${created.body.order.id}/status`).set(bearer(rider.token)).send({ status });
    }
    notifs = await request(app).get('/api/rider/notifications').set(bearer(rider.token));
    expect(notifs.body.notifications.some((n: { type: string }) => n.type === 'earning_credited')).toBe(true);

    const readAll = await request(app).post('/api/rider/notifications/read-all').set(bearer(rider.token));
    expect(readAll.status).toBe(200);
    notifs = await request(app).get('/api/rider/notifications').set(bearer(rider.token));
    expect(notifs.body.unreadCount).toBe(0);
  });
});
