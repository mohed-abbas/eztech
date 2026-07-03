import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Server as IOServer } from 'socket.io';
import type { Socket as ClientSocket } from 'socket.io-client';
import request from 'supertest';
import { buildApp } from '../src/app.js';
import { truncateRiderTables, truncateCatalogTables, testPrisma } from './helpers/db.js';
import { clearRiderPositions, riderPositions } from './helpers/mongo.js';
import { connectWith, mintToken, roomMembers, waitFor } from './helpers/socket.js';

// The socket implementation does not exist yet (delivered in Wave 2). Import it lazily so this
// suite PARSES and runs RED — every test must FAIL on a connection/assertion, not on a syntax or
// import-resolution error for the test-only modules above.
async function loadInitSocket(): Promise<(httpServer: HttpServer) => IOServer> {
  const mod = (await import('../src/lib/socket.js')) as { initSocket: (s: HttpServer) => IOServer };
  return mod.initSocket;
}

const app = buildApp();

// Paris coordinate used for the GeoJSON round-trip test (D-12 / Pitfall D).
const PARIS = { lng: 2.3522, lat: 48.8566 };

let httpServer: HttpServer;
let io: IOServer;
let port: number;
const openSockets: ClientSocket[] = [];

async function track(socket: ClientSocket): Promise<ClientSocket> {
  openSockets.push(socket);
  return socket;
}

// Seed a customer + an assigned rider on an order in picked_up so socket authz has real rows.
async function seedAssignedOrder() {
  const customer = await testPrisma.user.create({
    data: { email: `cust-${Date.now()}-${Math.random()}@example.com`, passwordHash: 'x', name: 'Cust', role: 'customer' },
  });
  const rider = await testPrisma.user.create({
    data: {
      email: `rider-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: 'x',
      name: 'Rider',
      role: 'rider',
      riderApplicationStatus: 'approved',
    },
  });
  const order = await testPrisma.order.create({
    data: {
      reference: `ORD-${Date.now()}-${Math.random()}`,
      customerId: customer.id,
      riderId: rider.id,
      status: 'picked_up',
      pickupAddress: '1 Quai, Paris',
      dropoffAddress: '10 Rue de Rivoli, Paris',
      dropoffLat: PARIS.lat,
      dropoffLng: PARIS.lng,
    },
  });
  return { customer, rider, order };
}

beforeAll(async () => {
  const initSocket = await loadInitSocket();
  httpServer = createServer(app);
  io = initSocket(httpServer);
  await new Promise<void>((r) => httpServer.listen(0, r));
  port = (httpServer.address() as AddressInfo).port;
});

afterAll(async () => {
  if (io) io.close();
  if (httpServer) await new Promise<void>((r) => httpServer.close(() => r()));
});

beforeEach(async () => {
  await truncateRiderTables();
  await truncateCatalogTables();
  await clearRiderPositions();
});

afterEach(() => {
  for (const s of openSockets.splice(0)) s.disconnect();
});

describe('socket realtime tracking (RED — implementation lands in Wave 2)', () => {
  it('broadcast reaches second client', async () => {
    // TRACK-01: rider:position broadcasts to a subscribed second client as {lat,lng}.
    const { customer, rider, order } = await seedAssignedOrder();
    const customerSock = await track(await connectWith(mintToken({ sub: customer.id, role: 'customer' }), port));
    const riderSock = await track(await connectWith(mintToken({ sub: rider.id, role: 'rider' }), port));

    customerSock.emit('subscribe:order', { orderId: order.id });
    await waitFor(customerSock, 'rider-moved').catch(() => undefined); // initial last-known (may be empty)

    const moved = waitFor<{ lat: number; lng: number }>(customerSock, 'rider-moved');
    riderSock.emit('rider:position', { orderId: order.id, lat: PARIS.lat, lng: PARIS.lng, accuracy: 5 });

    const payload = await moved;
    expect(payload).toMatchObject({ lat: PARIS.lat, lng: PARIS.lng });
  });

  it('forbidden join', async () => {
    // TRACK-02 / Pitfall C: a non-authorized subscribe:order → error{code:'FORBIDDEN'} and no room join.
    const { order } = await seedAssignedOrder();
    const intruder = await testPrisma.user.create({
      data: { email: `intruder-${Date.now()}-${Math.random()}@example.com`, passwordHash: 'x', name: 'X', role: 'customer' },
    });
    const sock = await track(await connectWith(mintToken({ sub: intruder.id, role: 'customer' }), port));

    const err = waitFor<{ code: string }>(sock, 'error');
    sock.emit('subscribe:order', { orderId: order.id });

    expect(await err).toMatchObject({ code: 'FORBIDDEN' });
    expect(roomMembers(io, `order:${order.id}`)).toHaveLength(0);
  });

  it('non-assigned rider rejected', async () => {
    // TRACK-03: rider:position from a non-assigned/non-rider socket is not persisted, not broadcast.
    const { order } = await seedAssignedOrder();
    const otherRider = await testPrisma.user.create({
      data: {
        email: `other-${Date.now()}-${Math.random()}@example.com`,
        passwordHash: 'x',
        name: 'Other',
        role: 'rider',
        riderApplicationStatus: 'approved',
      },
    });
    const sock = await track(await connectWith(mintToken({ sub: otherRider.id, role: 'rider' }), port));

    sock.emit('rider:position', { orderId: order.id, lat: PARIS.lat, lng: PARIS.lng, accuracy: 5 });
    await new Promise((r) => setTimeout(r, 300));

    const doc = await (await riderPositions()).findOne({ orderId: order.id });
    expect(doc).toBeNull();
  });

  it('last-known on load', async () => {
    // TRACK-04: on subscribe:order the last-known Mongo doc is emitted immediately as rider-moved.
    const { customer, order } = await seedAssignedOrder();
    await (await riderPositions()).insertOne({
      orderId: order.id,
      riderId: 'seed',
      location: { type: 'Point', coordinates: [PARIS.lng, PARIS.lat] },
      accuracy: 5,
      at: new Date(),
    });
    const sock = await track(await connectWith(mintToken({ sub: customer.id, role: 'customer' }), port));

    const moved = waitFor<{ lat: number; lng: number }>(sock, 'rider-moved');
    sock.emit('subscribe:order', { orderId: order.id });

    expect(await moved).toMatchObject({ lat: PARIS.lat, lng: PARIS.lng });
  });

  it('handshake rejects bad jwt', async () => {
    // TRACK-05: handshake rejects bad/missing JWT (connect_error); a valid token connects.
    await expect(connectWith('garbage-token', port)).rejects.toBeTruthy();

    const { customer } = await seedAssignedOrder();
    const good = await track(await connectWith(mintToken({ sub: customer.id, role: 'customer' }), port));
    expect(good.connected).toBe(true);
  });

  it('exp disconnect', async () => {
    // Pitfall B: a token expiring ~1s triggers a server-side disconnect on the long-lived socket.
    const { customer } = await seedAssignedOrder();
    const sock = await track(
      await connectWith(mintToken({ sub: customer.id, role: 'customer' }, { expiresIn: '1s' }), port),
    );
    await waitFor(sock, 'disconnect', 3000);
    expect(sock.connected).toBe(false);
  });

  it('paris round-trip', async () => {
    // Pitfall D: insert Paris [lng,lat] = [2.3522,48.8566]; emitted payload is {lat:48.8566,lng:2.3522}.
    const { customer, rider, order } = await seedAssignedOrder();
    const customerSock = await track(await connectWith(mintToken({ sub: customer.id, role: 'customer' }), port));
    const riderSock = await track(await connectWith(mintToken({ sub: rider.id, role: 'rider' }), port));

    customerSock.emit('subscribe:order', { orderId: order.id });
    const moved = waitFor<{ lat: number; lng: number }>(customerSock, 'rider-moved');
    riderSock.emit('rider:position', { orderId: order.id, lat: PARIS.lat, lng: PARIS.lng, accuracy: 5 });

    const payload = await moved;
    expect(payload.lat).toBe(48.8566);
    expect(payload.lng).toBe(2.3522);

    const doc = await (await riderPositions()).findOne({ orderId: order.id });
    expect(doc?.['location'].coordinates).toEqual([2.3522, 48.8566]); // stored as [lng,lat]
  });

  it('mongo singleton', async () => {
    // Pitfall E / D-09: initMongo twice returns the same client; closeMongo then getMongo throws.
    const mongo = (await import('../src/lib/mongo.js')) as {
      initMongo: (uri: string) => Promise<void>;
      getMongo: () => unknown;
      closeMongo: () => Promise<void>;
    };
    const uri = process.env['MONGODB_URI'] as string;
    await mongo.initMongo(uri);
    const a = mongo.getMongo();
    await mongo.initMongo(uri);
    const b = mongo.getMongo();
    expect(a).toBe(b);
    await mongo.closeMongo();
    expect(() => mongo.getMongo()).toThrow();
  });

  it('no emit on mongo failure', async () => {
    // Pitfall F / D-14: if the Mongo write throws, no order-status/rider-moved emit; Postgres unaffected.
    const { customer, rider, order } = await seedAssignedOrder();
    const customerSock = await track(await connectWith(mintToken({ sub: customer.id, role: 'customer' }), port));
    const riderSock = await track(await connectWith(mintToken({ sub: rider.id, role: 'rider' }), port));
    customerSock.emit('subscribe:order', { orderId: order.id });
    await waitFor(customerSock, 'rider-moved').catch(() => undefined);

    // force the Mongo write to fail by dropping the collection's write path
    await (await riderPositions()).drop().catch(() => undefined);

    let broadcast = false;
    customerSock.on('rider-moved', () => {
      broadcast = true;
    });
    riderSock.emit('rider:position', { orderId: order.id, lat: PARIS.lat, lng: PARIS.lng, accuracy: 5 });
    await new Promise((r) => setTimeout(r, 300));
    expect(broadcast).toBe(false);

    // the HTTP/Postgres path is unaffected — the order still reads back over the BFF
    const customerToken = mintToken({ sub: customer.id, role: 'customer' });
    const res = await request(app).get(`/api/orders/${order.id}`).set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
  });

  it('socket cors origins', async () => {
    // Pitfall G / D-13: the Server's cors.origin comes from CORS_ORIGIN, never '*'.
    // @ts-expect-error engine.opts is untyped on the Server instance
    const corsOrigin = io.engine?.opts?.cors?.origin ?? (io as unknown as { _opts?: { cors?: { origin?: unknown } } })._opts?.cors?.origin;
    expect(corsOrigin).not.toBe('*');
    expect(corsOrigin).toBeTruthy();
  });

  it('own bell room membership, no cross-user leak', async () => {
    // T-06-07: an authed socket joins user:<its own sub> and is never a member of another user's room.
    const { customer, rider } = await seedAssignedOrder();
    const customerSock = await track(await connectWith(mintToken({ sub: customer.id, role: 'customer' }), port));
    await waitFor(customerSock, '__never__', 200).catch(() => undefined); // settle time for the async join

    expect(roomMembers(io, `user:${customer.id}`)).toContain(customerSock.id);
    expect(roomMembers(io, `user:${rider.id}`)).not.toContain(customerSock.id);
  });

  it('approved+online rider joins riders:available', async () => {
    // T-06-08: role==='rider' && riderApplicationStatus==='approved' && riderOnline=true → joined.
    const { rider } = await seedAssignedOrder();
    await testPrisma.user.update({ where: { id: rider.id }, data: { riderOnline: true } });
    const riderSock = await track(await connectWith(mintToken({ sub: rider.id, role: 'rider' }), port));
    await waitFor(riderSock, '__never__', 200).catch(() => undefined);

    expect(roomMembers(io, 'riders:available')).toContain(riderSock.id);
  });

  it('unapproved/offline rider and non-rider do not join riders:available', async () => {
    const { customer, rider } = await seedAssignedOrder();
    // rider seeded approved but offline (riderOnline defaults false) — must NOT join.
    const riderSock = await track(await connectWith(mintToken({ sub: rider.id, role: 'rider' }), port));
    // a non-rider (customer role) must never join riders:available either.
    const customerSock = await track(await connectWith(mintToken({ sub: customer.id, role: 'customer' }), port));
    await waitFor(riderSock, '__never__', 200).catch(() => undefined);

    expect(roomMembers(io, 'riders:available')).not.toContain(riderSock.id);
    expect(roomMembers(io, 'riders:available')).not.toContain(customerSock.id);
  });

  it('throttle floor', async () => {
    // Pitfall H / D-06: 5 emits in <1s → at most 1 Mongo write + 1 broadcast.
    const { customer, rider, order } = await seedAssignedOrder();
    const customerSock = await track(await connectWith(mintToken({ sub: customer.id, role: 'customer' }), port));
    const riderSock = await track(await connectWith(mintToken({ sub: rider.id, role: 'rider' }), port));
    customerSock.emit('subscribe:order', { orderId: order.id });
    await waitFor(customerSock, 'rider-moved').catch(() => undefined);

    let broadcasts = 0;
    customerSock.on('rider-moved', () => {
      broadcasts += 1;
    });
    for (let i = 0; i < 5; i += 1) {
      riderSock.emit('rider:position', { orderId: order.id, lat: PARIS.lat, lng: PARIS.lng, accuracy: 5 });
    }
    await new Promise((r) => setTimeout(r, 400));
    expect(broadcasts).toBeLessThanOrEqual(1);

    const count = await (await riderPositions()).countDocuments({ orderId: order.id });
    expect(count).toBeLessThanOrEqual(1);
  });
});
