import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app.js';
import { signAccessToken } from '../src/middleware/auth.js';
import { truncateRiderTables, testPrisma } from './helpers/db.js';

const app = buildApp();

const PATHS = [
  '/api/analytics/orders-per-day',
  '/api/analytics/revenue',
  '/api/analytics/top-products',
  '/api/analytics/delivery-time',
  '/api/analytics/active-riders',
] as const;

type AuthResponse = { token: string };

// L'admin est seede par globalSetup et preserve par truncateAuthTables — on mint son token
// directement plutot que de repasser par /api/auth/login (rate limit + mot de passe seede).
async function adminToken(): Promise<string> {
  const admin = await testPrisma.user.findUnique({ where: { email: 'admin@eztech.fr' } });
  if (!admin) throw new Error('admin non seede');
  return signAccessToken({ sub: admin.id, role: 'admin' });
}

async function customerToken(email = 'analytics-cust@example.com'): Promise<string> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'password123', name: 'Cust', phone: '' });
  return (res.body as AuthResponse).token;
}

async function createRider(email: string, opts: { online?: boolean; name?: string } = {}) {
  const user = await testPrisma.user.create({
    data: {
      email,
      name: opts.name ?? 'Rider',
      passwordHash: 'x',
      role: 'rider',
      riderApplicationStatus: 'approved',
      riderOnline: opts.online ?? false,
    },
  });
  return { id: user.id, token: signAccessToken({ sub: user.id, role: 'rider' }) };
}

let seq = 0;
type OrderSeed = {
  createdAt?: Date;
  status?: 'pending_assignment' | 'delivered' | 'cancelled' | 'awaiting_payment';
  paymentStatus?: 'paid' | 'awaiting_payment' | 'refunded' | 'failed';
  total?: number | null;
  riderId?: string;
  deliveredAt?: Date;
};

async function createOrder(seed: OrderSeed = {}) {
  seq += 1;
  return testPrisma.order.create({
    data: {
      reference: `EZ-AN${String(seq).padStart(4, '0')}`,
      pickupAddress: '1 rue du Depot',
      dropoffAddress: '2 rue du Client',
      ...(seed.createdAt ? { createdAt: seed.createdAt } : {}),
      ...(seed.status ? { status: seed.status } : {}),
      ...(seed.paymentStatus ? { paymentStatus: seed.paymentStatus } : {}),
      ...(seed.total !== undefined ? { total: seed.total } : {}),
      ...(seed.riderId ? { riderId: seed.riderId } : {}),
      ...(seed.deliveredAt ? { deliveredAt: seed.deliveredAt } : {}),
    },
  });
}

async function addItem(orderId: string, name: string, quantity: number, lineTotal: number) {
  return testPrisma.orderItem.create({
    data: {
      orderId,
      name,
      quantity,
      durationUnit: 'flat',
      durationValue: 1,
      unitPrice: lineTotal / quantity,
      lineTotal,
    },
  });
}

async function addEvent(orderId: string, status: 'picked_up' | 'delivered', at: Date) {
  return testPrisma.orderEvent.create({ data: { orderId, status, createdAt: at } });
}

beforeEach(async () => {
  await truncateRiderTables();
});

describe('GET /api/analytics/* — autorisation', () => {
  it.each(PATHS)('%s repond 401 missing_token sans credentials', async (path) => {
    const res = await request(app).get(path);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'missing_token' });
  });

  it.each(PATHS)('%s repond 403 forbidden pour un client', async (path) => {
    const token = await customerToken(`cust-${path.replace(/\W/g, '')}@example.com`);
    const res = await request(app).get(path).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('forbidden');
  });

  it.each(PATHS)('%s repond 403 forbidden pour un livreur', async (path) => {
    const rider = await createRider(`rider-${path.replace(/\W/g, '')}@example.com`);
    const res = await request(app).get(path).set('Authorization', `Bearer ${rider.token}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('forbidden');
  });

  it('repond 401 invalid_token sur un jeton malforme', async () => {
    const res = await request(app).get(PATHS[0]).set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_token');
  });
});

describe('GET /api/analytics/orders-per-day', () => {
  // REGRESSION FUSEAU HORAIRE : les colonnes sont des `timestamp without time zone` en UTC.
  // 2026-07-27T22:30:00Z, c'est le 28 juillet 00:30 a Paris — la commande DOIT tomber dans le
  // bucket du 28. Un date_trunc('day', "createdAt") naif la classerait au 27.
  it('classe les commandes par jour calendaire PARIS, pas par jour UTC', async () => {
    await createOrder({ createdAt: new Date('2026-07-27T10:00:00Z'), status: 'delivered', paymentStatus: 'paid' });
    await createOrder({ createdAt: new Date('2026-07-27T22:30:00Z') }); // = 2026-07-28 00:30 Paris
    await createOrder({ createdAt: new Date('2026-07-28T09:00:00Z'), status: 'cancelled' });

    const res = await request(app)
      .get('/api/analytics/orders-per-day?from=2026-07-27&to=2026-07-28')
      .set('Authorization', `Bearer ${await adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.range).toEqual({ from: '2026-07-27', to: '2026-07-28', timezone: 'Europe/Paris' });
    expect(res.body.points).toHaveLength(2);
    expect(res.body.points[0]).toEqual({
      date: '2026-07-27',
      orders: 1,
      paidOrders: 1,
      delivered: 1,
      cancelled: 0,
    });
    expect(res.body.points[1]).toEqual({
      date: '2026-07-28',
      orders: 2,
      paidOrders: 0,
      delivered: 0,
      cancelled: 1,
    });
    expect(res.body.totals).toEqual({ orders: 3, paidOrders: 1, delivered: 1, cancelled: 1 });
  });

  it('exclut ce qui tombe hors de la fenetre, bornes Paris incluses des deux cotes', async () => {
    // 21:30 UTC le 26 = 23:30 Paris le 26 → hors fenetre qui commence le 27
    await createOrder({ createdAt: new Date('2026-07-26T21:30:00Z') });
    await createOrder({ createdAt: new Date('2026-07-27T00:00:00Z') });

    const res = await request(app)
      .get('/api/analytics/orders-per-day?from=2026-07-27&to=2026-07-27')
      .set('Authorization', `Bearer ${await adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.points).toHaveLength(1);
    expect(res.body.totals.orders).toBe(1);
  });

  it('renvoie une serie contigue zero-remplie sur une fenetre vide', async () => {
    const res = await request(app)
      .get('/api/analytics/orders-per-day?from=2026-01-01&to=2026-01-03')
      .set('Authorization', `Bearer ${await adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.points).toHaveLength(3);
    expect(res.body.points.map((p: { date: string }) => p.date)).toEqual([
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
    ]);
    expect(res.body.points.every((p: { orders: number }) => p.orders === 0)).toBe(true);
    expect(res.body.totals).toEqual({ orders: 0, paidOrders: 0, delivered: 0, cancelled: 0 });
  });

  it('renvoie 30 points par defaut quand aucune date n est fournie', async () => {
    const res = await request(app)
      .get('/api/analytics/orders-per-day')
      .set('Authorization', `Bearer ${await adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.points).toHaveLength(30);
    expect(res.body.range.timezone).toBe('Europe/Paris');
  });
});

describe('GET /api/analytics/revenue', () => {
  it('ne compte que paymentStatus=paid et signale les totaux manquants', async () => {
    await createOrder({ createdAt: new Date('2026-06-10T09:00:00Z'), paymentStatus: 'paid', total: 100.5 });
    await createOrder({ createdAt: new Date('2026-06-11T09:00:00Z'), paymentStatus: 'paid', total: 49.5 });
    await createOrder({ createdAt: new Date('2026-06-11T10:00:00Z'), paymentStatus: 'paid', total: null }); // ligne historique
    await createOrder({ createdAt: new Date('2026-06-11T11:00:00Z'), paymentStatus: 'awaiting_payment', total: 999 });
    await createOrder({ createdAt: new Date('2026-06-11T12:00:00Z'), paymentStatus: 'refunded', total: 777 });

    const res = await request(app)
      .get('/api/analytics/revenue?from=2026-06-10&to=2026-06-12')
      .set('Authorization', `Bearer ${await adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(150);
    expect(res.body.paidOrders).toBe(3);
    expect(res.body.ordersMissingTotal).toBe(1);
    expect(res.body.averageOrderValue).toBe(50);
    expect(res.body.currency).toBe('EUR');
    expect(res.body.revenueAnchor).toBe('order.createdAt');
    expect(res.body.granularity).toBe('day');
    expect(res.body.buckets).toEqual([
      { date: '2026-06-10', revenue: 100.5, orders: 1 },
      { date: '2026-06-11', revenue: 49.5, orders: 2 },
      { date: '2026-06-12', revenue: 0, orders: 0 },
    ]);
  });

  it('renvoie la forme vide documentee, averageOrderValue 0 et non null', async () => {
    const res = await request(app)
      .get('/api/analytics/revenue?from=2026-02-01&to=2026-02-02')
      .set('Authorization', `Bearer ${await adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.paidOrders).toBe(0);
    expect(res.body.averageOrderValue).toBe(0);
    expect(res.body.ordersMissingTotal).toBe(0);
    expect(res.body.buckets).toEqual([
      { date: '2026-02-01', revenue: 0, orders: 0 },
      { date: '2026-02-02', revenue: 0, orders: 0 },
    ]);
  });

  it('bascule en granularite mensuelle au-dela de 62 jours', async () => {
    await createOrder({ createdAt: new Date('2026-01-15T09:00:00Z'), paymentStatus: 'paid', total: 10 });
    await createOrder({ createdAt: new Date('2026-03-02T09:00:00Z'), paymentStatus: 'paid', total: 20 });

    const res = await request(app)
      .get('/api/analytics/revenue?from=2026-01-01&to=2026-03-31')
      .set('Authorization', `Bearer ${await adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.granularity).toBe('month');
    expect(res.body.buckets).toEqual([
      { date: '2026-01-01', revenue: 10, orders: 1 },
      { date: '2026-02-01', revenue: 0, orders: 0 },
      { date: '2026-03-01', revenue: 20, orders: 1 },
    ]);
    expect(res.body.total).toBe(30);
  });

  it('accepte period=week et echoue proprement sur un period inconnu', async () => {
    const token = await adminToken();
    const ok = await request(app).get('/api/analytics/revenue?period=week').set('Authorization', `Bearer ${token}`);
    expect(ok.status).toBe(200);
    expect(ok.body.period).toBe('week');
    expect(ok.body.buckets).toHaveLength(7);

    const ko = await request(app).get('/api/analytics/revenue?period=decade').set('Authorization', `Bearer ${token}`);
    expect(ko.status).toBe(422);
    expect(ko.body.error).toBe('validation_failed');
  });
});

describe('GET /api/analytics/top-products', () => {
  it('agrege par nom snapshot, compte les commandes distinctes et ignore les non payees', async () => {
    const a = await createOrder({ createdAt: new Date('2026-05-02T09:00:00Z'), paymentStatus: 'paid', total: 50 });
    const b = await createOrder({ createdAt: new Date('2026-05-03T09:00:00Z'), paymentStatus: 'paid', total: 30 });
    const unpaid = await createOrder({ createdAt: new Date('2026-05-03T10:00:00Z'), paymentStatus: 'awaiting_payment' });

    await addItem(a.id, 'Casque X', 2, 20);
    await addItem(b.id, 'Casque X', 3, 30);
    await addItem(a.id, 'Souris Y', 1, 30);
    await addItem(unpaid.id, 'Casque X', 50, 500); // hors perimetre : commande non payee

    const res = await request(app)
      .get('/api/analytics/top-products?from=2026-05-01&to=2026-05-04')
      .set('Authorization', `Bearer ${await adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(5);
    expect(res.body.products).toHaveLength(2);
    expect(res.body.products[0]).toEqual({
      productId: null,
      name: 'Casque X',
      imageUrl: '',
      quantity: 5,
      orders: 2,
      revenue: 50,
    });
    expect(res.body.products[1].name).toBe('Souris Y');
    expect(res.body.products[1].orders).toBe(1);
  });

  it('respecte limit et renvoie un tableau vide sans donnees', async () => {
    const token = await adminToken();
    const order = await createOrder({ createdAt: new Date('2026-05-02T09:00:00Z'), paymentStatus: 'paid', total: 10 });
    await addItem(order.id, 'A', 3, 9);
    await addItem(order.id, 'B', 2, 8);

    const limited = await request(app)
      .get('/api/analytics/top-products?from=2026-05-01&to=2026-05-04&limit=1')
      .set('Authorization', `Bearer ${token}`);
    expect(limited.status).toBe(200);
    expect(limited.body.limit).toBe(1);
    expect(limited.body.products).toHaveLength(1);
    expect(limited.body.products[0].name).toBe('A');

    const empty = await request(app)
      .get('/api/analytics/top-products?from=2026-09-01&to=2026-09-04')
      .set('Authorization', `Bearer ${token}`);
    expect(empty.status).toBe(200);
    expect(empty.body.products).toEqual([]);
  });
});

describe('GET /api/analytics/delivery-time', () => {
  it('mesure picked_up → delivered et exclut les livraisons sans evenement de retrait', async () => {
    const withPickup = await createOrder({ status: 'delivered' });
    await addEvent(withPickup.id, 'picked_up', new Date('2026-04-10T08:00:00Z'));
    await addEvent(withPickup.id, 'delivered', new Date('2026-04-10T08:30:00Z'));

    const withoutPickup = await createOrder({ status: 'delivered' });
    await addEvent(withoutPickup.id, 'delivered', new Date('2026-04-10T09:00:00Z'));

    const res = await request(app)
      .get('/api/analytics/delivery-time?from=2026-04-10&to=2026-04-10')
      .set('Authorization', `Bearer ${await adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.unit).toBe('minutes');
    expect(res.body.deliveredInPeriod).toBe(2);
    expect(res.body.sampleSize).toBe(1);
    expect(res.body.excludedMissingPickupEvent).toBe(1);
    // la livraison sans retrait ne doit PAS tirer la moyenne vers 0
    expect(res.body.averageMinutes).toBe(30);
    expect(res.body.medianMinutes).toBe(30);
    expect(res.body.p90Minutes).toBe(30);
    expect(res.body.fastestMinutes).toBe(30);
    expect(res.body.slowestMinutes).toBe(30);
  });

  it('calcule mediane et p90 sur plusieurs livraisons', async () => {
    const durations = [10, 20, 30, 40, 120];
    for (const minutes of durations) {
      const order = await createOrder({ status: 'delivered' });
      await addEvent(order.id, 'picked_up', new Date('2026-04-11T06:00:00Z'));
      await addEvent(order.id, 'delivered', new Date(Date.UTC(2026, 3, 11, 6, minutes)));
    }

    const res = await request(app)
      .get('/api/analytics/delivery-time?from=2026-04-11&to=2026-04-11')
      .set('Authorization', `Bearer ${await adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.sampleSize).toBe(5);
    expect(res.body.averageMinutes).toBe(44);
    expect(res.body.medianMinutes).toBe(30);
    expect(res.body.p90Minutes).toBe(88);
    expect(res.body.fastestMinutes).toBe(10);
    expect(res.body.slowestMinutes).toBe(120);
  });

  it('renvoie null — jamais 0 — quand l echantillon est vide', async () => {
    const res = await request(app)
      .get('/api/analytics/delivery-time?from=2026-03-01&to=2026-03-02')
      .set('Authorization', `Bearer ${await adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      unit: 'minutes',
      source: 'OrderEvent(picked_up → delivered)',
      averageMinutes: null,
      medianMinutes: null,
      p90Minutes: null,
      fastestMinutes: null,
      slowestMinutes: null,
      sampleSize: 0,
      deliveredInPeriod: 0,
      excludedMissingPickupEvent: 0,
    });
  });
});

describe('GET /api/analytics/active-riders', () => {
  it('separe onlineNow (instantane) de activeInPeriod (fenetre)', async () => {
    const online = await createRider('rider-online@example.com', { online: true, name: 'Alice' });
    const offline = await createRider('rider-offline@example.com', { online: false, name: 'Bob' });

    const o1 = await createOrder({ riderId: online.id, deliveredAt: new Date('2026-04-15T10:00:00Z'), status: 'delivered' });
    await addEvent(o1.id, 'delivered', new Date('2026-04-15T10:00:00Z'));
    const o2 = await createOrder({ riderId: online.id, deliveredAt: new Date('2026-04-15T12:00:00Z'), status: 'delivered' });
    await addEvent(o2.id, 'delivered', new Date('2026-04-15T12:00:00Z'));
    const o3 = await createOrder({ riderId: offline.id, deliveredAt: new Date('2026-04-16T12:00:00Z'), status: 'delivered' });
    await addEvent(o3.id, 'delivered', new Date('2026-04-16T12:00:00Z'));

    const res = await request(app)
      .get('/api/analytics/active-riders?from=2026-04-15&to=2026-04-16')
      .set('Authorization', `Bearer ${await adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.onlineNow).toBe(1);
    expect(res.body.approvedRiders).toBe(2);
    expect(res.body.onlineNowIsPointInTime).toBe(true);
    expect(res.body.activeInPeriod).toBe(2);
    expect(res.body.topRiders).toEqual([
      { riderId: online.id, name: 'Alice', deliveries: 2 },
      { riderId: offline.id, name: 'Bob', deliveries: 1 },
    ]);
  });

  it('renvoie la forme vide documentee', async () => {
    const res = await request(app)
      .get('/api/analytics/active-riders?from=2026-03-01&to=2026-03-02')
      .set('Authorization', `Bearer ${await adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      onlineNow: 0,
      onlineNowIsPointInTime: true,
      activeInPeriod: 0,
      approvedRiders: 0,
      topRiders: [],
    });
  });
});

describe('GET /api/analytics/* — validation des parametres', () => {
  it('refuse une date au mauvais format', async () => {
    const res = await request(app)
      .get('/api/analytics/orders-per-day?from=27-07-2026')
      .set('Authorization', `Bearer ${await adminToken()}`);
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('validation_failed');
    expect(Array.isArray(res.body.details.issues)).toBe(true);
  });

  it('refuse limit=0 et limit=99', async () => {
    const token = await adminToken();
    const zero = await request(app).get('/api/analytics/top-products?limit=0').set('Authorization', `Bearer ${token}`);
    expect(zero.status).toBe(422);
    expect(zero.body.error).toBe('validation_failed');

    const tooBig = await request(app).get('/api/analytics/top-products?limit=99').set('Authorization', `Bearer ${token}`);
    expect(tooBig.status).toBe(422);
    expect(tooBig.body.error).toBe('validation_failed');
  });

  it('refuse from > to', async () => {
    const res = await request(app)
      .get('/api/analytics/orders-per-day?from=2026-07-10&to=2026-07-01')
      .set('Authorization', `Bearer ${await adminToken()}`);
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('invalid_range');
  });

  it('refuse une fenetre de plus de 366 jours', async () => {
    const res = await request(app)
      .get('/api/analytics/orders-per-day?from=2025-01-01&to=2026-07-01')
      .set('Authorization', `Bearer ${await adminToken()}`);
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('range_too_large');
  });

  // Une saisie utilisateur ne doit jamais produire un 500 : une annee extreme faisait deborder la
  // borne haute en annee etendue (+010000-01-01), un format que Postgres refuse.
  it('refuse une annee hors plage sans remonter un 500', async () => {
    const token = await adminToken();
    for (const qs of ['from=9999-12-01&to=9999-12-31', 'from=1899-01-01&to=1899-01-05']) {
      const res = await request(app)
        .get(`/api/analytics/orders-per-day?${qs}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('validation_failed');
    }
  });

  // "2026-02-31" passait la regex puis etait reporte au 3 mars, pendant que la reponse continuait
  // d'annoncer la date saisie dans range.from — un ecart silencieux entre la question et la reponse.
  it('refuse une date calendaire impossible', async () => {
    const res = await request(app)
      .get('/api/analytics/orders-per-day?from=2026-02-31&to=2026-03-05')
      .set('Authorization', `Bearer ${await adminToken()}`);
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('validation_failed');
  });
});
