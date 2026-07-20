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

beforeEach(async () => {
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
