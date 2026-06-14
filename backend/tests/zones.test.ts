import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app.js';
import { truncateRiderTables, truncateCatalogTables, truncateAuthTables, testPrisma } from './helpers/db.js';

const app = buildApp();

type AuthResponse = { token: string };

async function adminToken(): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email: 'admin@eztech.fr', password: 'adminpass123' });
  return (res.body as AuthResponse).token;
}

async function customerToken(email = 'cust@example.com'): Promise<string> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'password123', name: 'Cust', phone: '' });
  return (res.body as AuthResponse).token;
}

const PARIS_POLYGON = {
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
};

async function seedZone() {
  return testPrisma.zone.create({ data: { name: 'Paris', isActive: true, geometry: PARIS_POLYGON } });
}

async function seedWarehouse() {
  return testPrisma.warehouse.create({ data: { name: 'WH', address: '1 Quai', lat: 48.85, lng: 2.35 } });
}

async function seedStockedProduct() {
  const cat = await testPrisma.category.create({ data: { name: 'C', slug: 'zone-cat', description: '', icon: '' } });
  const product = await testPrisma.product.create({
    data: { name: 'P', slug: 'zone-prod', categoryId: cat.id, pricingType: 'flat', flatPrice: 3.5, sortPrice: 3.5, stock: 10 },
  });
  const wh = await seedWarehouse();
  await testPrisma.warehouseStock.create({ data: { warehouseId: wh.id, productId: product.id, quantity: 10 } });
  return product;
}

describe('service zone enforcement', () => {
  beforeEach(async () => {
    await truncateRiderTables();
    await truncateCatalogTables();
    await truncateAuthTables();
  });

  it('blocks a dropoff outside all zones with 422 and creates no order', async () => {
    const token = await customerToken();
    await seedZone();
    const product = await seedStockedProduct();

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productId: product.id, quantity: 1, durationUnit: 'flat', durationValue: 1 }],
        // far outside the Paris polygon (Marseille-ish)
        dropoff: { address: 'Marseille', lat: 43.3, lng: 5.4 },
      });

    expect(res.status).toBe(422);
    const count = await testPrisma.order.count();
    expect(count).toBe(0);
  });
});

describe('zone admin CRUD gating', () => {
  beforeEach(async () => {
    await truncateRiderTables();
    await truncateCatalogTables();
    await truncateAuthTables();
  });

  it('rejects a non-admin creating a zone with 403', async () => {
    const token = await customerToken();
    const res = await request(app)
      .post('/api/zones')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Zone', geometry: PARIS_POLYGON });
    expect(res.status).toBe(403);
  });

  it('lets an admin create a zone (201)', async () => {
    const token = await adminToken();
    const res = await request(app)
      .post('/api/zones')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Zone', geometry: PARIS_POLYGON });
    expect(res.status).toBe(201);
  });
});
