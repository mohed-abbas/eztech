import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app.js';
import { signAccessToken } from '../src/middleware/auth.js';
import { truncateRiderTables, truncateCatalogTables, testPrisma } from './helpers/db.js';

const app = buildApp();

type AuthResponse = { token: string };

// L'admin est seede par globalSetup et preserve par truncateAuthTables — on mint son token
// directement (independant du mot de passe seede).
async function adminToken(): Promise<string> {
  const admin = await testPrisma.user.findUnique({ where: { email: 'admin@eztech.fr' } });
  if (!admin) throw new Error('admin non seede');
  return signAccessToken({ sub: admin.id, role: 'admin' });
}

async function customerToken(email = 'wh-cust@example.com'): Promise<string> {
  const res = await request(app).post('/api/auth/register').send({ email, password: 'password123', name: 'Cust', phone: '' });
  return (res.body as AuthResponse).token;
}

async function createManager(email: string) {
  const user = await testPrisma.user.create({ data: { email, name: 'Mgr', passwordHash: 'x', role: 'warehouse_manager' } });
  return { id: user.id, token: signAccessToken({ sub: user.id, role: 'warehouse_manager' }) };
}

async function createWarehouse(managerId?: string) {
  return testPrisma.warehouse.create({ data: { name: 'WH', address: '1 Quai', lat: 48.85, lng: 2.35, ...(managerId ? { managerId } : {}) } });
}

async function stockAProduct(warehouseId: string, quantity = 5) {
  const cat = await testPrisma.category.create({ data: { name: 'C', slug: `wh-cat-${Math.round(quantity * 1000 + warehouseId.length)}`, description: '', icon: '' } });
  const product = await testPrisma.product.create({
    data: { name: 'P', slug: `wh-prod-${cat.id}`, categoryId: cat.id, pricingType: 'flat', flatPrice: 3.5, sortPrice: 3.5 },
  });
  await testPrisma.warehouseStock.create({ data: { warehouseId, productId: product.id, quantity } });
  return product;
}

let orderSeq = 0;
async function createOrder(warehouseId: string, status: 'pending_assignment' | 'rider_assigned' | 'delivered' = 'pending_assignment') {
  orderSeq += 1;
  return testPrisma.order.create({
    data: { reference: `EZ-PREP-${orderSeq}`, status, warehouseId, pickupAddress: 'Entrepot', dropoffAddress: 'Client', riderFee: 5 },
  });
}

beforeEach(async () => {
  orderSeq = 0;
  await testPrisma.stockAdjustment.deleteMany();
  await testPrisma.warehouseStock.deleteMany();
  await testPrisma.warehouse.deleteMany();
  await truncateRiderTables();
  await truncateCatalogTables();
});

describe('warehouses API — gating admin', () => {
  it('rejette un non-admin qui cree un entrepot (403)', async () => {
    const token = await customerToken();
    const res = await request(app).post('/api/warehouses').set('Authorization', `Bearer ${token}`)
      .send({ name: 'New', address: '2 Rue', lat: 48.8, lng: 2.3 });
    expect(res.status).toBe(403);
  });

  it('laisse un admin creer un entrepot (201)', async () => {
    const token = await adminToken();
    const res = await request(app).post('/api/warehouses').set('Authorization', `Bearer ${token}`)
      .send({ name: 'New', address: '2 Rue', lat: 48.8, lng: 2.3 });
    expect(res.status).toBe(201);
    expect(res.body.warehouse.name).toBe('New');
  });

  it('liste les entrepots pour un utilisateur authentifie', async () => {
    await createWarehouse();
    const token = await customerToken('wh-list@example.com');
    const res = await request(app).get('/api/warehouses').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.warehouses)).toBe(true);
    expect(res.body.warehouses.length).toBeGreaterThanOrEqual(1);
  });

  it('permet a un admin d\'assigner un managerId (PATCH)', async () => {
    const token = await adminToken();
    const wh = await createWarehouse();
    const mgr = await createManager('assign-mgr@example.com');
    const res = await request(app).patch(`/api/warehouses/${wh.id}`).set('Authorization', `Bearer ${token}`)
      .send({ managerId: mgr.id });
    expect(res.status).toBe(200);
    expect(res.body.warehouse.managerId).toBe(mgr.id);
  });
});

describe('warehouses API — stock scoping', () => {
  it('un manager voit le stock de SON entrepot', async () => {
    const mgr = await createManager('own-mgr@example.com');
    const wh = await createWarehouse(mgr.id);
    await stockAProduct(wh.id, 7);
    const res = await request(app).get(`/api/warehouses/${wh.id}/stock`).set('Authorization', `Bearer ${mgr.token}`);
    expect(res.status).toBe(200);
    expect(res.body.stock[0].quantity).toBe(7);
  });

  it('un manager ne voit PAS le stock d\'un autre entrepot (403)', async () => {
    const mgr = await createManager('scoped-mgr@example.com');
    const other = await createWarehouse(); // aucun manager
    const res = await request(app).get(`/api/warehouses/${other.id}/stock`).set('Authorization', `Bearer ${mgr.token}`);
    expect(res.status).toBe(403);
  });
});

describe('warehouses API — commandes a preparer', () => {
  it('liste les commandes a preparer de SON entrepot', async () => {
    const mgr = await createManager('prep-mgr@example.com');
    const wh = await createWarehouse(mgr.id);
    await createOrder(wh.id, 'pending_assignment');
    await createOrder(wh.id, 'delivered'); // ne doit PAS apparaitre

    const res = await request(app).get(`/api/warehouses/${wh.id}/orders`).set('Authorization', `Bearer ${mgr.token}`);
    expect(res.status).toBe(200);
    expect(res.body.orders.length).toBe(1);
    expect(res.body.orders[0].status).toBe('pending_assignment');
  });

  it('un manager marque une commande prete pour le ramassage', async () => {
    const mgr = await createManager('prep-mgr2@example.com');
    const wh = await createWarehouse(mgr.id);
    const order = await createOrder(wh.id);

    const res = await request(app).patch(`/api/warehouses/${wh.id}/orders/${order.id}/prepare`).set('Authorization', `Bearer ${mgr.token}`);
    expect(res.status).toBe(200);
    expect(res.body.order.preparedAt).not.toBeNull();
  });

  it('un manager ne peut pas preparer une commande d\'un autre entrepot (403)', async () => {
    const mgr = await createManager('prep-mgr3@example.com');
    await createWarehouse(mgr.id); // son entrepot
    const other = await createWarehouse(); // autre entrepot, sans manager
    const order = await createOrder(other.id);

    const res = await request(app).patch(`/api/warehouses/${other.id}/orders/${order.id}/prepare`).set('Authorization', `Bearer ${mgr.token}`);
    expect(res.status).toBe(403);
  });
});
