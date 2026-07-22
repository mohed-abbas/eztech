import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app.js';
import { signAccessToken } from '../src/middleware/auth.js';
import { truncateRiderTables, truncateCatalogTables, testPrisma } from './helpers/db.js';

const app = buildApp();

// L'admin est seede par globalSetup et preserve par truncateAuthTables — on mint son token
// directement (independant du mot de passe seede).
async function adminToken(): Promise<string> {
  const admin = await testPrisma.user.findUnique({ where: { email: 'admin@eztech.fr' } });
  if (!admin) throw new Error('admin non seede');
  return signAccessToken({ sub: admin.id, role: 'admin' });
}

async function createManager(email: string) {
  const user = await testPrisma.user.create({ data: { email, name: 'Mgr', passwordHash: 'x', role: 'warehouse_manager' } });
  return { id: user.id, token: signAccessToken({ sub: user.id, role: 'warehouse_manager' }) };
}

async function createWarehouse(managerId?: string, name = 'WH') {
  return testPrisma.warehouse.create({ data: { name, address: '1 Quai', lat: 48.85, lng: 2.35, ...(managerId ? { managerId } : {}) } });
}

let productSeq = 0;
async function createProduct() {
  productSeq += 1;
  const cat = await testPrisma.category.create({ data: { name: 'C', slug: `inv-cat-${productSeq}`, description: '', icon: '' } });
  return testPrisma.product.create({
    data: { name: 'P', slug: `inv-prod-${productSeq}`, categoryId: cat.id, pricingType: 'flat', flatPrice: 3.5, sortPrice: 3.5 },
  });
}

beforeEach(async () => {
  productSeq = 0;
  await testPrisma.stockAdjustment.deleteMany();
  await testPrisma.warehouseStock.deleteMany();
  await testPrisma.warehouse.deleteMany();
  await truncateRiderTables();
  await truncateCatalogTables();
});

describe('inventory API — ajustement de stock', () => {
  it('un manager ajuste le stock de SON entrepot et journalise le delta', async () => {
    const mgr = await createManager('inv-own@example.com');
    const wh = await createWarehouse(mgr.id);
    const product = await createProduct();
    await testPrisma.warehouseStock.create({ data: { warehouseId: wh.id, productId: product.id, quantity: 5 } });

    const res = await request(app).patch(`/api/inventory/${wh.id}/${product.id}`)
      .set('Authorization', `Bearer ${mgr.token}`).send({ quantity: 20, reason: 'reappro' });

    expect(res.status).toBe(200);
    expect(res.body.stock.quantity).toBe(20);

    const log = await testPrisma.stockAdjustment.findFirst({ where: { warehouseId: wh.id, productId: product.id } });
    expect(log?.delta).toBe(15); // 20 - 5
    expect(log?.actorId).toBe(mgr.id);
  });

  it('un manager NE PEUT PAS ajuster le stock d\'un autre entrepot (403) et ne modifie rien', async () => {
    const mgr = await createManager('inv-scoped@example.com');
    const other = await createWarehouse(undefined, 'Autre');
    const product = await createProduct();
    await testPrisma.warehouseStock.create({ data: { warehouseId: other.id, productId: product.id, quantity: 5 } });

    const res = await request(app).patch(`/api/inventory/${other.id}/${product.id}`)
      .set('Authorization', `Bearer ${mgr.token}`).send({ quantity: 99 });

    expect(res.status).toBe(403);
    const unchanged = await testPrisma.warehouseStock.findUnique({ where: { warehouseId_productId: { warehouseId: other.id, productId: product.id } } });
    expect(unchanged?.quantity).toBe(5);
    const logs = await testPrisma.stockAdjustment.count();
    expect(logs).toBe(0);
  });

  it('un admin ajuste n\'importe quel entrepot', async () => {
    const token = await adminToken();
    const wh = await createWarehouse();
    const product = await createProduct();
    const res = await request(app).patch(`/api/inventory/${wh.id}/${product.id}`)
      .set('Authorization', `Bearer ${token}`).send({ quantity: 12 });
    expect(res.status).toBe(200);
    expect(res.body.stock.quantity).toBe(12);
  });

  it('retourne le stock d\'un entrepot avec le detail produit', async () => {
    const mgr = await createManager('inv-get@example.com');
    const wh = await createWarehouse(mgr.id);
    const product = await createProduct();
    await testPrisma.warehouseStock.create({ data: { warehouseId: wh.id, productId: product.id, quantity: 8 } });

    const res = await request(app).get(`/api/inventory/${wh.id}`).set('Authorization', `Bearer ${mgr.token}`);
    expect(res.status).toBe(200);
    expect(res.body.stock[0].quantity).toBe(8);
    expect(res.body.stock[0].product.name).toBe('P');
  });

  it('rejette une quantite negative (422)', async () => {
    const token = await adminToken();
    const wh = await createWarehouse();
    const product = await createProduct();
    const res = await request(app).patch(`/api/inventory/${wh.id}/${product.id}`)
      .set('Authorization', `Bearer ${token}`).send({ quantity: -3 });
    expect(res.status).toBe(422);
  });
});
