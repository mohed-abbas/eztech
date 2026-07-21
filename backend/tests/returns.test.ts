import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { signAccessToken } from '../src/middleware/auth.js';
import { truncateRiderTables, truncateCatalogTables, testPrisma } from './helpers/db.js';

const app = buildApp();

async function createManager(email: string) {
  const user = await testPrisma.user.create({ data: { email, name: 'Mgr', passwordHash: 'x', role: 'warehouse_manager' } });
  return { id: user.id, token: signAccessToken({ sub: user.id, role: 'warehouse_manager' }) };
}

async function createCustomer(email: string) {
  const user = await testPrisma.user.create({ data: { email, name: 'Cust', passwordHash: 'x', role: 'customer' } });
  return { id: user.id, token: signAccessToken({ sub: user.id, role: 'customer' }) };
}

let seq = 0;
async function createStockedProduct(warehouseId: string, quantity: number) {
  seq += 1;
  const cat = await testPrisma.category.create({ data: { name: 'C', slug: `ret-cat-${seq}`, description: '', icon: '' } });
  const product = await testPrisma.product.create({
    data: { name: 'P', slug: `ret-prod-${seq}`, categoryId: cat.id, pricingType: 'flat', flatPrice: 3.5, sortPrice: 3.5 },
  });
  await testPrisma.warehouseStock.create({ data: { warehouseId, productId: product.id, quantity } });
  return product;
}

// une commande livrée + un article, puis un retour collecté (completed) lié à cette commande
async function createCompletedReturn(customerId: string, productId: string, quantity: number) {
  const order = await testPrisma.order.create({
    data: {
      reference: `EZ-${seq}-${Math.round(quantity)}`,
      status: 'delivered',
      customerId,
      pickupAddress: 'Entrepot',
      dropoffAddress: 'Client',
      riderFee: new Prisma.Decimal(5),
      items: { create: { productId, name: 'P', quantity, durationUnit: 'flat', durationValue: 1, unitPrice: new Prisma.Decimal(3.5), lineTotal: new Prisma.Decimal(3.5 * quantity) } },
    },
  });
  return testPrisma.return.create({
    data: { reference: `RET-${seq}-${quantity}`, status: 'completed', orderId: order.id, customerId, pickupAddress: 'Client', completedAt: new Date() },
  });
}

beforeEach(async () => {
  seq = 0;
  await testPrisma.stockAdjustment.deleteMany();
  await testPrisma.warehouseStock.deleteMany();
  await testPrisma.warehouse.deleteMany();
  await truncateRiderTables();
  await truncateCatalogTables();
});

describe('returns process — inspection entrepot', () => {
  it('available : remet en stock les articles et notifie le client', async () => {
    const mgr = await createManager('ret-mgr@example.com');
    const wh = await testPrisma.warehouse.create({ data: { name: 'WH', address: '1', lat: 48.8, lng: 2.3, managerId: mgr.id } });
    const product = await createStockedProduct(wh.id, 2);
    const customer = await createCustomer('ret-cust@example.com');
    const ret = await createCompletedReturn(customer.id, product.id, 3);

    const res = await request(app).patch(`/api/returns/${ret.id}/process`)
      .set('Authorization', `Bearer ${mgr.token}`).send({ result: 'available', note: 'ok' });

    expect(res.status).toBe(200);
    expect(res.body.return.inspectionResult).toBe('available');

    const stock = await testPrisma.warehouseStock.findUnique({ where: { warehouseId_productId: { warehouseId: wh.id, productId: product.id } } });
    expect(stock?.quantity).toBe(5); // 2 + 3

    const log = await testPrisma.stockAdjustment.findFirst({ where: { warehouseId: wh.id, productId: product.id } });
    expect(log?.delta).toBe(3);

    const notif = await testPrisma.notification.findFirst({ where: { userId: customer.id, type: 'return_processed' } });
    expect(notif).not.toBeNull();
  });

  it('damaged : ne remet rien en stock', async () => {
    const mgr = await createManager('ret-mgr2@example.com');
    const wh = await testPrisma.warehouse.create({ data: { name: 'WH', address: '1', lat: 48.8, lng: 2.3, managerId: mgr.id } });
    const product = await createStockedProduct(wh.id, 4);
    const customer = await createCustomer('ret-cust2@example.com');
    const ret = await createCompletedReturn(customer.id, product.id, 3);

    const res = await request(app).patch(`/api/returns/${ret.id}/process`)
      .set('Authorization', `Bearer ${mgr.token}`).send({ result: 'damaged' });

    expect(res.status).toBe(200);
    const stock = await testPrisma.warehouseStock.findUnique({ where: { warehouseId_productId: { warehouseId: wh.id, productId: product.id } } });
    expect(stock?.quantity).toBe(4); // inchange
    expect(await testPrisma.stockAdjustment.count()).toBe(0);
  });

  it('rejette un non-manager (403)', async () => {
    const mgr = await createManager('ret-mgr3@example.com');
    const wh = await testPrisma.warehouse.create({ data: { name: 'WH', address: '1', lat: 48.8, lng: 2.3, managerId: mgr.id } });
    const product = await createStockedProduct(wh.id, 2);
    const customer = await createCustomer('ret-cust3@example.com');
    const ret = await createCompletedReturn(customer.id, product.id, 1);

    const res = await request(app).patch(`/api/returns/${ret.id}/process`)
      .set('Authorization', `Bearer ${customer.token}`).send({ result: 'available' });
    expect(res.status).toBe(403);
  });

  it('rejette un retour non collecte (422)', async () => {
    const mgr = await createManager('ret-mgr4@example.com');
    await testPrisma.warehouse.create({ data: { name: 'WH', address: '1', lat: 48.8, lng: 2.3, managerId: mgr.id } });
    const ret = await testPrisma.return.create({ data: { reference: 'RET-SCHED', status: 'scheduled', pickupAddress: 'X' } });

    const res = await request(app).patch(`/api/returns/${ret.id}/process`)
      .set('Authorization', `Bearer ${mgr.token}`).send({ result: 'available' });
    expect(res.status).toBe(422);
  });

  it('rejette un double traitement (409)', async () => {
    const mgr = await createManager('ret-mgr5@example.com');
    const wh = await testPrisma.warehouse.create({ data: { name: 'WH', address: '1', lat: 48.8, lng: 2.3, managerId: mgr.id } });
    const product = await createStockedProduct(wh.id, 2);
    const customer = await createCustomer('ret-cust5@example.com');
    const ret = await createCompletedReturn(customer.id, product.id, 1);

    await request(app).patch(`/api/returns/${ret.id}/process`).set('Authorization', `Bearer ${mgr.token}`).send({ result: 'available' });
    const res = await request(app).patch(`/api/returns/${ret.id}/process`).set('Authorization', `Bearer ${mgr.token}`).send({ result: 'available' });
    expect(res.status).toBe(409);
  });
});
